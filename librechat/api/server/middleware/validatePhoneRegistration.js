const { isEnabled } = require('~/server/utils');
const { validateSchema } = require('~/strategies/validators/schemaValidation');
const { phoneRegisterSchema } = require('~/strategies/validators');
const { getVerificationCodeFromStorage } = require('~/server/utils/verificationStorage');

/**
 * Middleware to validate phone registration requests
 * Checks if:
 * 1. Phone registration is allowed
 * 2. The request body contains valid phone registration data
 * 3. The verification code matches the one sent to the phone
 */
async function validatePhoneRegistration(req, res, next) {
  // Check if registration is allowed
  if (!isEnabled(process.env.ALLOW_PHONE_REGISTRATION)) {
    return res.status(403).json({
      message: 'Phone registration is not allowed.',
    });
  }

  // Validate request body against the schema
  const schemaResult = validateSchema(phoneRegisterSchema, req.body);
  if (schemaResult !== true) {
    return res.status(400).json({ error: schemaResult });
  }

  // Verify the verification code
  try {
    const { phoneNumber, code } = req.body;
    const storedCode = await getVerificationCodeFromStorage(phoneNumber);
    
    if (!storedCode) {
      return res.status(400).json({ 
        message: 'Verification code has expired or was not sent. Please request a new code.' 
      });
    }

    if (storedCode !== code) {
      return res.status(400).json({ 
        message: 'Invalid verification code. Please try again or request a new code.' 
      });
    }

    next();
  } catch (error) {
    console.error('Error validating phone registration:', error);
    return res.status(500).json({ 
      message: 'Failed to validate phone registration. Please try again later.' 
    });
  }
}

module.exports = validatePhoneRegistration;

