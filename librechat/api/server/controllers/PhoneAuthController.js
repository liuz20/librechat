const User = require('../../models/User');
const { getVerificationCodeFromStorage, saveVerificationCodeToStorage } = require('../utils/verificationStorage');
const { generateVerificationCode } = require('../utils/generators');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { phoneLoginSchema, phoneRegisterSchema } = require('../../strategies/validators');
const { validateSchema } = require('../middlewares/validationMiddleware');
const { SMSService } = require('../services/SMSService');

/**
 * Send a verification code to the phone number
 * @route POST /api/auth/phone/send-verification-code
 */
const sendVerificationCodeController = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    
    // Generate a random 6-digit verification code
    const code = generateVerificationCode();
    
    // Save the verification code to storage (in-memory for development, Redis for production)
    await saveVerificationCodeToStorage(phoneNumber, code);
    
    // Send the verification code via SMS
    try {
      await SMSService.sendVerificationCode(phoneNumber, code);
      logger.info(`Verification code sent to ${phoneNumber}`);
      return res.status(200).json({ message: 'Verification code sent successfully' });
    } catch (smsError) {
      logger.error('[sendVerificationCodeController] SMS sending error:', smsError);
      return res.status(500).json({ message: 'Failed to send verification code' });
    }
  } catch (error) {
    logger.error('[sendVerificationCodeController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Verify a phone number with the provided verification code
 * @route POST /api/auth/phone/verify
 */
const verifyPhoneController = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }
    
    // Get the stored verification code
    const storedCode = await getVerificationCodeFromStorage(phoneNumber);
    
    if (!storedCode) {
      return res.status(400).json({ message: 'Verification code has expired or does not exist' });
    }
    
    // Verify the code
    if (storedCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    return res.status(200).json({ message: 'Phone number verified successfully' });
  } catch (error) {
    logger.error('[verifyPhoneController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Register a new user with phone number
 * @route POST /api/auth/phone/register
 */
const phoneRegisterController = async (req, res) => {
  // Validate request body
  const { error, value } = phoneRegisterSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.message });
  }
  
  const { phoneNumber, code, username, password } = value;
  
  try {
    // Check if the phone number is already registered
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number is already registered' });
    }
    
    // Verify the code
    const storedCode = await getVerificationCodeFromStorage(phoneNumber);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // Create the new user
    const newUser = new User({
      username,
      phoneNumber,
      phoneVerified: true
    });
    
    // Set password
    await newUser.setPassword(password);
    
    // Save the user
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    logger.info(`User registered with phone number: ${phoneNumber}`);
    
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        phoneNumber: newUser.phoneNumber,
        phoneVerified: newUser.phoneVerified
      }
    });
  } catch (error) {
    logger.error('[phoneRegisterController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Login with phone number and verification code
 * @route POST /api/auth/phone/login
 */
const phoneLoginController = async (req, res) => {
  // Validate request body
  const { error, value } = phoneLoginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.message });
  }
  
  const { phoneNumber, code } = value;
  
  try {
    // Find the user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ message: 'User not found with this phone number' });
    }
    
    // Verify the code
    const storedCode = await getVerificationCodeFromStorage(phoneNumber);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // If the user's phone is not verified, mark it as verified
    if (!user.phoneVerified) {
      user.phoneVerified = true;
      await user.save();
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    logger.info(`User logged in with phone number: ${phoneNumber}`);
    
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    logger.error('[phoneLoginController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Link a phone number to an existing account
 * @route POST /api/auth/phone/link
 */
const linkPhoneController = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming authentication middleware sets req.user
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }
    
    // Check if the phone number is already used by another account
    const existingUser = await User.findOne({ phoneNumber, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number is already linked to another account' });
    }
    
    // Verify the code
    const storedCode = await getVerificationCodeFromStorage(phoneNumber);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // Update the user's phone number
    await User.findByIdAndUpdate(userId, {
      phoneNumber,
      phoneVerified: true
    });
    
    logger.info(`Phone number ${phoneNumber} linked to user ID: ${userId}`);
    
    return res.status(200).json({ message: 'Phone number linked successfully' });
  } catch (error) {
    logger.error('[linkPhoneController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  sendVerificationCodeController,
  verifyPhoneController,
  phoneRegisterController,
  phoneLoginController,
  linkPhoneController
};

