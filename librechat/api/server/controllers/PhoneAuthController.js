const User = require('../../models/User');
const { getVerificationCodeFromStorage, saveVerificationCodeToStorage } = require('../utils/verificationStorage');
const { generateVerificationCode } = require('../utils/generators');
const jwt = require('jsonwebtoken');
const { logger } = require('~/config');
const { phoneLoginSchema, phoneRegisterSchema } = require('../../strategies/validators');
const SMSService = require('../services/SMSService');

/**
 * @typedef {Object} ErrorResponse
 * @property {string} message - Error message
 */

/**
 * Request verification code for phone number
 * @route POST /api/auth/phone/request-verification
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const requestVerificationController = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Basic phone number format check
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const code = generateVerificationCode();
    // Store with 5-minute expiration (300 seconds)
    await saveVerificationCodeToStorage(phone, code, 300);
    
    try {
      await SMSService.sendVerificationCode({ phoneNumber: phone, code });
      logger.info(`Verification code sent to ${phone}`);
      return res.status(200).json({ message: 'Verification code sent successfully' });
    } catch (smsError) {
      logger.error('[requestVerificationController] SMS error:', smsError);
      return res.status(503).json({ 
        message: 'Failed to send verification code', 
        error: process.env.NODE_ENV === 'development' ? smsError.message : undefined 
      });
    }
  } catch (error) {
    logger.error('[requestVerificationController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Verify phone number with code
 * @route POST /api/auth/phone/verify-code
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const verifyCodeController = async (req, res) => {
  try {
    const { phone, verificationCode } = req.body;
    
    if (!phone || !verificationCode) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }

    const storedCode = await getVerificationCodeFromStorage(phone);
    
    if (!storedCode) {
      return res.status(400).json({ message: 'Verification code expired or not found' });
    }
    
    if (storedCode !== verificationCode) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    return res.status(200).json({ message: 'Phone number verified successfully' });
  } catch (error) {
    logger.error('[verifyCodeController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Register new user with phone number
 * @route POST /api/auth/phone/register
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const phoneRegisterController = async (req, res) => {
  const { error, value } = phoneRegisterSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { phone, verificationCode, username, name, password, token } = value;

  try {
    const existingUser = await User.findOne({ $or: [{ phone }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.phone === phone 
          ? 'Phone number already registered' 
          : 'Username already taken' 
      });
    }

    const storedCode = await getVerificationCodeFromStorage(phone);
    if (!storedCode || storedCode !== verificationCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const newUser = new User({
      username,
      name,
      phone,
      phoneVerified: true
    });

    await newUser.setPassword(password);
    await newUser.save();

    const jwtPayload = { id: newUser._id, username: newUser.username };
    const jwtToken = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User registered with phone: ${phone}`);
    
    return res.status(201).json({
      message: 'User registered successfully',
      token: jwtToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        phone: newUser.phone,
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
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const phoneLoginController = async (req, res) => {
  const { error, value } = phoneLoginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { phone, verificationCode } = value;

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this phone number' });
    }

    const storedCode = await getVerificationCodeFromStorage(phone);
    if (!storedCode || storedCode !== verificationCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    if (!user.phoneVerified) {
      user.phoneVerified = true;
      await user.save();
    }

    const jwtPayload = { id: user._id, username: user.username };
    const token = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User logged in with phone: ${phone}`);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    logger.error('[phoneLoginController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Link phone number to existing account
 * @route POST /api/auth/phone/link
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const linkPhoneController = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { phone, verificationCode } = req.body;
    if (!phone || !verificationCode) {
      return res.status(400).json({ message: 'Phone number and verification code required' });
    }

    const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already linked to another account' });
    }

    const storedCode = await getVerificationCodeFromStorage(phone);
    if (!storedCode || storedCode !== verificationCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { phone, phoneVerified: true },
      { new: true }
    );

    logger.info(`Phone ${phone} linked to user ID: ${userId}`);

    return res.status(200).json({
      message: 'Phone number linked successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    logger.error('[linkPhoneController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Send verification code for phone number
 * @route POST /api/auth/phone/send-verification
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const sendVerificationCodeController = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Validate phone number format
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const code = generateVerificationCode();
    // Store with 5-minute expiration (300 seconds)
    await saveVerificationCodeToStorage(phone, code, 300);
    
    try {
      await SMSService.sendVerificationCode({ phoneNumber: phone, code });
      logger.info(`Verification code sent to ${phone}`);
      return res.status(200).json({ message: 'Verification code sent successfully' });
    } catch (smsError) {
      logger.error('[sendVerificationCodeController] SMS error:', smsError);
      return res.status(503).json({ 
        message: 'Failed to send verification code',
        error: process.env.NODE_ENV === 'development' ? smsError.message : undefined
      });
    }
  } catch (error) {
    logger.error('[sendVerificationCodeController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Verify phone number
 * @route POST /api/auth/phone/verify-phone
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const verifyPhoneController = async (req, res) => {
  try {
    const { phone, verificationCode } = req.body;
    
    if (!phone || !verificationCode) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }

    const storedCode = await getVerificationCodeFromStorage(phone);
    
    if (!storedCode) {
      return res.status(400).json({ message: 'Verification code expired or not found' });
    }
    
    if (storedCode !== verificationCode) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    return res.status(200).json({ message: 'Phone number verified successfully' });
  } catch (error) {
    logger.error('[verifyPhoneController]', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  requestVerificationController,
  verifyCodeController,
  phoneRegisterController,
  phoneLoginController,
  linkPhoneController,
  sendVerificationCodeController,
  verifyPhoneController
};
