const { createToken, findToken, deleteTokens } = require('~/models');
const { findUser, updateUser } = require('~/models/userMethods');
const { sendVerificationCode } = require('~/server/services/SMSService');
const bcrypt = require('bcryptjs');
const { logger } = require('~/config');

/**
 * Generates a 6-digit verification code
 * @returns {string} A 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Sends a verification code to the provided phone number
 * @param {string} phoneNumber - The phone number to send the code to
 * @returns {Promise<string>} The verification code that was sent
 */
const sendPhoneVerificationCode = async (phoneNumber) => {
  try {
    // Generate a new verification code
    const verificationCode = generateVerificationCode();
    
    // Hash the code for storage
    const codeHash = bcrypt.hashSync(verificationCode, 10);
    
    // Find if there's a user with this phone number
    const user = await findUser({ phoneNumber });
    
    // Delete any existing tokens for this phone number
    await deleteTokens({ phoneNumber });
    
    // Create a new token record
    await createToken({
      userId: user ? user._id : null,
      phoneNumber,
      token: codeHash,
      createdAt: Date.now(),
      expiresIn: 300, // 5 minutes
    });
    
    // Send the verification code via SMS
    await sendVerificationCode({
      phoneNumber,
      code: verificationCode
    });
    
    logger.info(`[PhoneVerificationService.sendPhoneVerificationCode] Verification code sent to ${phoneNumber}`);
    
    return verificationCode;
  } catch (error) {
    logger.error('[PhoneVerificationService.sendPhoneVerificationCode] Error:', error);
    throw error;
  }
};

/**
 * Verifies a phone verification code
 * @param {string} phoneNumber - The phone number to verify
 * @param {string} code - The verification code to check
 * @returns {Promise<boolean>} Whether the verification was successful
 */
const verifyPhoneCode = async (phoneNumber, code) => {
  try {
    // Find the verification token
    const verificationData = await findToken({ phoneNumber });
    
    if (!verificationData) {
      logger.warn(`[PhoneVerificationService.verifyPhoneCode] No verification data found for ${phoneNumber}`);
      return false;
    }
    
    // Check if the token is expired
    const now = Date.now();
    const tokenCreated = new Date(verificationData.createdAt).getTime();
    const tokenExpiry = tokenCreated + (verificationData.expiresIn * 1000);
    
    if (now > tokenExpiry) {
      logger.warn(`[PhoneVerificationService.verifyPhoneCode] Verification code expired for ${phoneNumber}`);
      await deleteTokens({ phoneNumber });
      return false;
    }
    
    // Verify the code
    const isValid = bcrypt.compareSync(code, verificationData.token);
    
    if (!isValid) {
      logger.warn(`[PhoneVerificationService.verifyPhoneCode] Invalid verification code for ${phoneNumber}`);
      return false;
    }
    
    // Find the user if one exists
    const user = await findUser({ phoneNumber });
    
    // Mark phone as verified if a user exists
    if (user && !user.phoneVerified) {
      await updateUser(user._id, { phoneVerified: true });
      logger.info(`[PhoneVerificationService.verifyPhoneCode] Phone verified for user ${user._id}`);
    }
    
    // Delete the used token
    await deleteTokens({ phoneNumber });
    
    return true;
  } catch (error) {
    logger.error('[PhoneVerificationService.verifyPhoneCode] Error:', error);
    return false;
  }
};

module.exports = {
  sendPhoneVerificationCode,
  verifyPhoneCode,
  generateVerificationCode
};

