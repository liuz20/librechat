const { z } = require('zod');
const { getResponseStatusCode } = require('../../utils');
const { phoneLoginSchema } = require('../../strategies/validators');
const { getApiConfig } = require('~/server/utils/ApiConfig');

/**
 * Middleware to validate phone login requests
 * Checks if phone login is enabled and validates the phone number and verification code
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validatePhoneLogin = async (req, res, next) => {
  try {
    const apiConfig = getApiConfig();
    
    // Check if phone authentication is enabled
    if (!apiConfig?.phoneLogin?.enabled) {
      return res.status(400).json({ message: 'Phone login is not enabled' });
    }

    // Validate request body against the phone login schema
    const validationResult = phoneLoginSchema.safeParse(req.body);

    if (!validationResult.success) {
      const statusCode = getResponseStatusCode(validationResult.error);
      const errorMessage = validationResult.error.issues.map(issue => issue.message).join(', ');
      
      return res.status(statusCode).json({ 
        message: 'Phone login validation failed', 
        error: errorMessage 
      });
    }

    // Validation passed, proceed to the next middleware
    req.phoneLoginData = validationResult.data;
    next();
  } catch (error) {
    console.error('Error validating phone login request:', error);
    return res.status(500).json({ message: 'Internal server error during phone login validation' });
  }
};

module.exports = validatePhoneLogin;

