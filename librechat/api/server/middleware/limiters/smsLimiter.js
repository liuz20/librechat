const rateLimit = require('express-rate-limit');
const { removePorts } = require('~/server/utils');
const { logViolation } = require('~/cache');
const { logger } = require('~/config');

const {
  SMS_WINDOW = 5,
  SMS_MAX = 3,
  SMS_VIOLATION_SCORE: score = 2,
  SMS_RATE_LIMIT_WINDOW,
  SMS_RATE_LIMIT_MAX
} = process.env;

// Use either specific SMS rate limit config or fallback to general SMS limits
const windowMs = parseInt(SMS_RATE_LIMIT_WINDOW, 10) || (SMS_WINDOW * 60 * 1000);
const max = parseInt(SMS_RATE_LIMIT_MAX, 10) || SMS_MAX;
const windowInMinutes = windowMs / 60000;

/**
 * SMS rate limiter middleware
 * Limits the number of SMS verification code requests per user/IP within a specified window
 */
const smsLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Use user ID if authenticated, otherwise use IP address (with ports removed)
  keyGenerator: (req) => {
    const identifier = req.user?.id || removePorts(req);
    return `sms:${identifier}`;
  },

  // Skip rate limiting in test environment
  skip: (req) => process.env.NODE_ENV === 'test',

  // Custom handler for rate limit exceeded
  handler: async (req, res) => {
    const identifier = req.user?.id || removePorts(req);
    logger.warn(`[SMS Rate Limit] Request blocked for ${identifier}: Too many requests`);

    const type = 'sms';
    const errorMessage = {
      type,
      max,
      windowInMinutes,
    };

    // Log the violation for potential ban tracking
    await logViolation(req, res, type, errorMessage, score);

    return res.status(429).json({
      message: `Too many SMS verification code requests, please try again after ${windowInMinutes} minutes.`,
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) // Time in seconds until the limit resets
    });
  },

  // Called when a client hits the rate limit
  onLimitReached: (req) => {
    const identifier = req.user?.id || removePorts(req);
    logger.warn(`[SMS Rate Limit] Limit reached for ${identifier}`);
  }
});

module.exports = smsLimiter;

