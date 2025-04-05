const { setAuthTokens } = require('~/server/services/AuthService');
const { sendVerificationCode } = require('~/server/services/SMSService');
const { findUser } = require('~/models/userMethods');
const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { createToken, findToken, deleteTokens } = require('~/models');
const { logger } = require('~/config');
const bcrypt = require('bcryptjs');

/**
 * Identifies whether the provided identifier is an email or phone number
 * @param {string} identifier - The identifier to check
 * @returns {'email'|'phone'|'unknown'} The type of identifier
 */
const identifyInputType = (identifier) => {
  if (!identifier) return 'unknown';
  
  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(identifier)) {
    return 'email';
  }
  
  // Phone number validation regex (E.164 format with optional + prefix)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (phoneRegex.test(identifier)) {
    return 'phone';
  }
  
  return 'unknown';
};

/**
 * Handles phone login via verification code
 */
const phoneLoginController = async (req, res) => {
  try {
    const { phoneNumber, verificationCode } = req.body;

    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }

    const user = await findUser({ phoneNumber });
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found',
        requiresRegistration: true 
      });
    }

    // Find the stored verification code
    const storedToken = await findToken({ phoneNumber });
    if (!storedToken) {
      return res.status(401).json({ message: 'No verification code found' });
    }

    // Verify the code
    const isValidCode = await bcrypt.compare(verificationCode, storedToken.token);
    if (!isValidCode) {
      return res.status(401).json({ message: 'Invalid verification code' });
    }

    // Check if code has expired
    const now = Date.now();
    if (now > storedToken.createdAt + (storedToken.expiresIn * 1000)) {
      await deleteTokens({ phoneNumber });
      return res.status(401).json({ message: 'Verification code has expired' });
    }

    // Clean up used token
    await deleteTokens({ phoneNumber });

    if (user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }

    const userData = user.toObject ? user.toObject() : { ...user };
    const { password: _p, totpSecret: _t, __v, ...cleanUserData } = userData;
    cleanUserData.id = cleanUserData._id.toString();

    const token = await setAuthTokens(user._id, res);
    return res.status(200).json({ token, user: cleanUserData });
  } catch (err) {
    logger.error('[phoneLoginController]', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

/**
 * Handles sending verification code for phone authentication
 */
const sendPhoneVerificationCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || identifyInputType(phoneNumber) !== 'phone') {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const user = await findUser({ phoneNumber });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Clear any existing tokens
    await deleteTokens({ phoneNumber });
    
    // Hash the code for secure storage
    const codeHash = bcrypt.hashSync(code, 10);
    
    // Store new verification code
    await createToken({
      userId: user ? user._id : null,
      phoneNumber,
      token: codeHash,
      createdAt: Date.now(),
      expiresIn: 300 // 5 minutes
    });
    
    await sendVerificationCode({
      phoneNumber,
      code
    });

    return res.status(200).json({ 
      message: 'Verification code sent',
      requiresRegistration: !user
    });
  } catch (err) {
    logger.error('[sendPhoneVerificationCode]', err);
    return res.status(500).json({ message: 'Failed to send verification code' });
  }
};

/**
 * Unified login controller that handles both email and phone authentication
 */
const unifiedLoginController = async (req, res) => {
  try {
    const { identifier, password, verificationCode } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }

    const identifierType = identifyInputType(identifier);
    
    switch (identifierType) {
      case 'email':
        // Direct email authentication
        if (!password) {
          return res.status(400).json({ message: 'Password is required for email login' });
        }

        const user = await findUser({ email: identifier });
        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        if (user.twoFactorEnabled) {
          const tempToken = generate2FATempToken(user._id);
          return res.status(200).json({ twoFAPending: true, tempToken });
        }
        
        const userData = user.toObject ? user.toObject() : { ...user };
        const { password: _p, totpSecret: _t, __v, ...cleanUserData } = userData;
        cleanUserData.id = cleanUserData._id.toString();
        
        const token = await setAuthTokens(user._id, res);
        return res.status(200).json({ token, user: cleanUserData });

      case 'phone':
        if (!verificationCode) {
          // If no verification code provided, send one
          return sendPhoneVerificationCode({
            ...req,
            body: { phoneNumber: identifier }
          }, res);
        }
        // Handle phone login with verification code
        return phoneLoginController({
          ...req,
          body: { phoneNumber: identifier, verificationCode }
        }, res);
      
      default:
        return res.status(400).json({ message: 'Invalid email or phone number format' });
    }
  } catch (err) {
    logger.error('[unifiedLoginController]', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  unifiedLoginController,
  sendPhoneVerificationCode,
  phoneLoginController,
  identifyInputType
};

