const express = require('express');
const { 
  refreshController,
  resetPasswordController,
  resetPasswordRequestController,
  registrationController,
} = require('~/server/controllers/AuthController');
const {
  sendVerificationCodeController,
  verifyPhoneController,
  phoneRegisterController,
  linkPhoneController,
} = require('~/server/controllers/PhoneAuthController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { verify2FA } = require('~/server/controllers/auth/TwoFactorAuthController');
const { 
  unifiedLoginController, 
  sendPhoneVerificationCode, 
  phoneLoginController 
} = require('~/server/controllers/auth/UnifiedLoginController');
const {
  enable2FAController,
  verify2FAController,
  disable2FAController,
  regenerateBackupCodesController, confirm2FAController,
} = require('~/server/controllers/TwoFactorController');
const {
  checkBan,
  loginLimiter,
  requireJwtAuth,
  checkInviteUser,
  registerLimiter,
  requireLdapAuth,
  requireLocalAuth,
  resetPasswordLimiter,
  validateRegistration,
  validatePasswordReset,
  validatePhoneRegistration,
  validatePhoneLogin,
  smsLimiter,
} = require('~/server/middleware');

const router = express.Router();

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', requireJwtAuth, logoutController);

/**
 * @deprecated Use unified login system instead
 */
router.post(
  '/login',
  loginLimiter,
  checkBan,
  ldapAuth ? requireLdapAuth : requireLocalAuth,
  loginController,
);

// Unified login system routes
router.post(
  '/unified/login',
  loginLimiter,
  checkBan,
  unifiedLoginController
);

router.post(
  '/unified/send-verification',
  smsLimiter,
  checkBan,
  sendPhoneVerificationCode
);

// Phone-specific login route (used by unified system)
router.post(
  '/unified/phone-login',
  loginLimiter,
  checkBan,
  validatePhoneLogin,
  phoneLoginController
);
router.post('/refresh', refreshController);
router.post(
  '/register',
  registerLimiter,
  checkBan,
  checkInviteUser,
  validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  resetPasswordLimiter,
  checkBan,
  validatePasswordReset,
  resetPasswordRequestController,
);
router.post('/resetPassword', checkBan, validatePasswordReset, resetPasswordController);

router.get('/2fa/enable', requireJwtAuth, enable2FAController);
router.post('/2fa/verify', requireJwtAuth, verify2FAController);
router.post('/2fa/verify-temp', checkBan, verify2FA);
router.post('/2fa/confirm', requireJwtAuth, confirm2FAController);
router.post('/2fa/disable', requireJwtAuth, disable2FAController);
router.post('/2fa/backup/regenerate', requireJwtAuth, regenerateBackupCodesController);

/**
 * @deprecated Use unified login system instead
 * Legacy phone authentication routes
 * Maintained for backward compatibility
 */
router.post('/verify-phone', checkBan, verifyPhoneController);
router.post(
  '/phone-register',
  registerLimiter,
  checkBan,
  checkInviteUser,
  validatePhoneRegistration,
  phoneRegisterController
);
router.post('/link-phone', requireJwtAuth, linkPhoneController);

module.exports = router;
