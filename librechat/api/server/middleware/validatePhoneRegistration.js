const { z } = require('zod');
const { isEnabled } = require('../../utils');
const { getVerificationCodeFromStorage } = require('../utils/verificationStorage');
const { logger } = require('~/config');

/**
 * Zod schema for phone registration validation
 * @type {z.ZodObject}
 */
const phoneRegisterSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must not exceed 50 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * Middleware to validate phone registration requests
 * Validates phone registration prerequisites and request data
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Promise<void>}
 */
const validatePhoneRegistration = async (req, res, next) => {
  try {
    // Check if phone registration is allowed
    if (!isEnabled(process.env.ALLOW_PHONE_REGISTRATION)) {
      logger.warn('Phone registration attempted while disabled');
      return res.status(403).json({
        message: 'Phone registration is currently disabled',
      });
    }

    // Validate request body against schema
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

    // Verify the verification code
    const { phoneNumber, code } = validationResult.data;
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

    // Attach validated data to request object
    req.phoneRegistrationData = validationResult.data;
    logger.debug('Phone registration validation passed', { phoneNumber });
    
    next();
  } catch (error) {
    logger.error('Error in phone registration validation middleware:', error);
    return res.status(500).json({
      message: 'Internal server error during phone registration validation',
  error: error.message,
    });
  }
};

/**
 * Export both schema and middleware for consistency
 */
module.exports = {
  validatePhoneRegistration,
  phoneRegisterSchema,
};
