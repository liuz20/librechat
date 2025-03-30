const { z } = require('zod');
const { getResponseStatusCode } = require('../../utils');
const { logger } = require('~/config');

/**
 * Zod schema for phone login validation
 * @type {z.ZodObject}
 */
const phoneLoginSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  verificationCode: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers'),
});

/**
 * Middleware to validate phone login requests
 * Ensures phone login is enabled and validates request body
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Promise<void>}
 */
const validatePhoneLogin = async (req, res, next) => {
  try {
    // Check if phone authentication is enabled
    if (!process.env.PHONE_AUTH_ENABLED || process.env.PHONE_AUTH_ENABLED !== 'true') {
      logger.warn('Phone login attempted while disabled');
      return res.status(403).json({ 
        message: 'Phone authentication is currently disabled' 
      });
    }

    // Validate request body against schema
    const validationResult = phoneLoginSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(issue => ({
        field: issue.path[0],
        message: issue.message,
      }));

      logger.info('Phone login validation failed', {
        errors,
        body: req.body,
      });

      return res.status(400).json({ 
        message: 'Phone login validation failed',
        errors,
      });
    }

    // Attach validated data to request object
    req.phoneLoginData = validationResult.data;
    logger.debug('Phone login validation passed', { phone: req.phoneLoginData.phone });
    
    next();
  } catch (error) {
    logger.error('Error in phone login validation middleware:', error);
    return res.status(500).json({ 
      message: 'Internal server error during phone login validation',
      error: error.message,
    });
  }
};

/**
 * Export both schema and middleware for consistency
 */
module.exports = {
  validatePhoneLogin,
  phoneLoginSchema,
};
