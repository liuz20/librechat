const rateLimit = require('express-rate-limit');
const { removePorts } = require('~/server/utils');
const { logViolation } = require('~/cache');

const { SMS_WINDOW = 5, SMS_MAX = 3, SMS_VIOLATION_SCORE: score = 2 } = process.env;
const windowMs = SMS_WINDOW * 60 * 1000;
const max = SMS_MAX;
const windowInMinutes = windowMs / 60000;
const message = `Too many SMS verification code requests, please try again after ${windowInMinutes} minutes.`;

const handler = async (req, res) => {
  const type = 'sms';
  const errorMessage = {
    type,
    max,
    windowInMinutes,
  };

  await logViolation(req, res, type, errorMessage, score);
  return res.status(429).json({ message });
};

const smsLimiter = rateLimit({
  windowMs,
  max,
  handler,
  keyGenerator: removePorts,
});

module.exports = smsLimiter;

