const { z } = require('zod');
const { isEnabled } = require('~/server/utils');
const { logger } = require('~/config');
const { registerSchema, phoneRegisterSchema } = require('~/strategies/validators');
const { getVerificationCodeFromStorage } = require('../utils/verificationStorage');

/**
 * Middleware to validate both email and phone registration requests
 * Validates registration prerequisites and request data based on request type
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Promise<void>}
 */
const validateUnifiedRegistration = async (req, res, next) => {
  try {
    // Skip validation if invitation is provided
    if (req.invite) {
      return next();
    }

    const { email, phoneNumber, code } = req.body;

    // Determine registration type
    const isPhoneRegistration = phoneNumber && !email;
    const isEmailRegistration = email && !phoneNumber;

    if (!isPhoneRegistration && !isEmailRegistration) {
      return res.status(400).json({
        message: 'Either email or phone number must be provided for registration',
      });
    }

    // Check appropriate registration permission
    if (isEmailRegistration) {
      if (!isEnabled(process.env.ALLOW_REGISTRATION)) {
        logger.warn('Email registration attempted while disabled');
        return res.status(403).json({
          message: 'Email registration is not allowed.',
        });
      }

      // Validate email registration data
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
          field: issue.path[0],
          message: issue.message,
        }));

        logger.info('Email registration validation failed', {
          errors,
          body: req.body,
        });

        return res.status(400).json({
          message: 'Email registration validation failed',
          errors,
        });
      }

      req.registrationType = 'email';
      logger.debug('Email registration validation passed', { email });
    } else if (isPhoneRegistration) {
      if (!isEnabled(process.env.ALLOW_PHONE_REGISTRATION)) {
        logger.warn('Phone registration attempted while disabled');
        return res.status(403).json({
          message: 'Phone registration is currently disabled',
        });
      }

      // Validate phone registration data
      const validationResult = phoneRegisterSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
          field: issue.path[0],
          message: issue.message,
        }));

        logger.info('Phone registration validation failed', {
          errors,
          body: req.body,
        });

        return res.status(400).json({
          message: 'Phone registration validation failed',
          errors,
        });
      }

      // Verify the verification code for phone registration
      // This is only needed for the final phone registration step
      if (req.body.name && req.body.password) {
        const storedCode = await getVerificationCodeFromStorage(phoneNumber);

        if (!storedCode) {
          logger.info('No verification code found', { phoneNumber });
          return res.status(400).json({
            message: 'Verification code has expired or was not sent. Please request a new code.',
          });
        }

        if (storedCode !== code) {
          logger.info('Invalid verification code', { phoneNumber });
          return res.status(400).json({
            message: 'Invalid verification code. Please try again or request a new code.',
          });
        }
      }

      req.registrationType = 'phone';
      logger.debug('Phone registration validation passed', { phoneNumber });
    }

    // Pass the validated data to the next middleware/controller
    next();
  } catch (error) {
    logger.error('Error in unified registration validation middleware:', error);
    return res.status(500).json({
      message: 'Internal server error during registration validation',
      error: error.message,
    });
  }
};

module.exports = validateUnifiedRegistration;

