const express = require('express');
const router = express.Router();

const { verify2FA } = require('../controllers/auth/TwoFactorAuthController');
const { unifiedLoginController } = require('~/server/controllers/auth/UnifiedLoginController');
const { refreshController, registrationController, resetPasswordRequestController, resetPasswordController } = require('~/server/controllers/AuthController');

const {
  verify2FAController,
  disable2FAController,
  regenerateBackupCodesController, 
  confirm2FAController,
  enable2FAController,
} = require('~/server/controllers/TwoFactorController');

const {
  verifyPhoneController,
  phoneLoginController,
  phoneRegisterController,
  linkPhoneController,
  sendVerificationCodeController: sendPhoneVerificationCode,
} = require('~/server/controllers/PhoneAuthController');

const {
  checkBan,
  loginLimiter,
  requireJwtAuth,
  checkInviteUser,
  registerLimiter,
  requireLocalAuth,
  resetPasswordLimiter,
  validatePasswordReset,
  validatePhoneLogin,
  validateUnifiedRegistration,
  validateRegistration,
  smsLimiter,
} = require('~/server/middleware');

// Check if LDAP authentication is configured
const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;

// Token refresh
router.post('/refresh', refreshController);

// Unified login endpoint - handles both email and phone login
router.post(
  '/login',
  loginLimiter,
  checkBan,
  unifiedLoginController
);

// -------------------------
// Unified registration system
// -------------------------

// Registration endpoint - handles both email and phone registration
router.post(
  '/register',
  registerLimiter,
  checkBan,
  checkInviteUser,
  validateUnifiedRegistration,
  (req, res, next) => {
    // Route to appropriate controller based on registration type
    if (req.registrationType === 'phone') {
      return phoneRegisterController(req, res, next);
    } else {
      return registrationController(req, res, next);
    }
  }
);

// Phone verification code request endpoint
router.post(
  '/send-verification-code',
  smsLimiter,
  checkBan,
  sendPhoneVerificationCode
);

// -------------------------
// Password reset routes
// -------------------------
router.post(
  '/requestPasswordReset',
  resetPasswordLimiter,
  checkBan,
  validatePasswordReset,
  resetPasswordRequestController,
);
router.post('/resetPassword', checkBan, validatePasswordReset, resetPasswordController);

// -------------------------
// Two-factor authentication routes
// -------------------------
router.get('/2fa/enable', requireJwtAuth, enable2FAController);
router.post('/2fa/verify', requireJwtAuth, verify2FAController);
router.post('/2fa/verify-temp', checkBan, verify2FA);
router.post('/2fa/confirm', requireJwtAuth, confirm2FAController);
router.post('/2fa/disable', requireJwtAuth, disable2FAController);
router.post('/2fa/backup/regenerate', requireJwtAuth, regenerateBackupCodesController);

// -------------------------
// Unified login system routes
// -------------------------
router.post(
  '/unified/send-verification',
  smsLimiter,
  checkBan,
  sendPhoneVerificationCode
);

router.post(
  '/unified/phone-login',
  loginLimiter,
  checkBan,
  validatePhoneLogin,
  phoneLoginController
);

// -------------------------
// Legacy phone authentication routes 
// -------------------------
/**
 * @deprecated Use unified login/registration system instead
 * These routes are maintained for backward compatibility
 */
router.post('/verify-phone', checkBan, verifyPhoneController);
router.post('/link-phone', requireJwtAuth, linkPhoneController);

module.exports = router;
