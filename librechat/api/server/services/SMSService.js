const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');
const { logger } = require('~/config');

/**
 * SMS Service Configuration Guide
 * 
 * This service supports multiple SMS providers for sending verification codes
 * and notifications. Configure your preferred provider in the .env file.
 * 
 * Provider Options:
 * 1. Alibaba Cloud (SMS_PROVIDER=alibaba)
 *    - Required env vars:
 *      - ALIBABA_CLOUD_ACCESS_KEY_ID
 *      - ALIBABA_CLOUD_ACCESS_KEY_SECRET
 *      - ALIBABA_CLOUD_SMS_SIGN_NAME
 *      - ALIBABA_CLOUD_SMS_TEMPLATE_CODE (for verification)
 *      - ALIBABA_CLOUD_SMS_TEMPLATE_CODE_NOTIFICATION (for notifications)
 * 
 * 2. Mock Provider (SMS_PROVIDER=mock)
 *    - No configuration required
 *    - Logs messages to console instead of sending real SMS
 *    - Default in development environment
 * 
 * Rate Limiting:
 * - SMS_RATE_LIMIT_WINDOW: Time window in milliseconds (default: 60000)
 * - SMS_RATE_LIMIT_MAX: Maximum SMS per window per user (default: 5)
 */

// SMS Provider Types
const SMS_PROVIDER = {
  ALIBABA: 'alibaba',
  MOCK: 'mock'
};

// Determine the SMS provider to use
const SMS_PROVIDER_TYPE = process.env.SMS_PROVIDER || 
  (process.env.NODE_ENV === 'production' ? SMS_PROVIDER.ALIBABA : SMS_PROVIDER.MOCK);

/**
 * Creates an SMS client based on the configured provider
 * @returns {Object} Configured SMS client
 */
const createClient = () => {
  switch (SMS_PROVIDER_TYPE) {
    case SMS_PROVIDER.ALIBABA:
      if (!process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || !process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET) {
        throw new Error('Missing Alibaba Cloud credentials');
      }
      const config = new OpenApi.Config({
        accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      });
      config.endpoint = process.env.ALIBABA_CLOUD_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';
      return new Dysmsapi20170525(config);

    case SMS_PROVIDER.MOCK:
      return {
        mock: true,
        messages: {
          create: async (params) => ({
            sid: 'mock-' + Date.now(),
            status: 'sent',
            ...params
          })
        },
        sendSmsWithOptions: async () => ({
          body: {
            code: 'OK',
            message: 'Mock SMS sent successfully',
            requestId: 'mock-request-' + Date.now(),
            bizId: 'mock-biz-' + Math.floor(Math.random() * 1000000)
          }
        })
      };

    default:
      throw new Error(`Unsupported SMS provider: ${SMS_PROVIDER_TYPE}`);
  }
};

/**
 * Sends a verification code via SMS
 * @param {Object} params The parameters for sending verification code
 * @param {string} params.phoneNumber The phone number to send the code to
 * @param {string} params.code The verification code to send
 * @returns {Promise<Object>} The result of the SMS sending operation
 */
const sendVerificationCode = async ({ phoneNumber, code }) => {
  try {
    logger.info(`[SMSService] Sending verification code to ${phoneNumber}`);

    if (SMS_PROVIDER_TYPE === SMS_PROVIDER.MOCK) {
      logger.info(`[MOCK SMS] Verification code for ${phoneNumber}: ${code}`);
      console.log(`🔑 MOCK SMS VERIFICATION: Phone: ${phoneNumber}, Code: ${code}`);
      return {
        success: true,
        mode: 'mock',
        messageId: 'mock-' + Date.now()
      };
    }

    const client = createClient();

    if (SMS_PROVIDER_TYPE === SMS_PROVIDER.ALIBABA) {
      const runtime = new Util.RuntimeOptions({});
      const sendSmsRequest = new Dysmsapi20170525.SendSmsRequest({
        phoneNumbers: phoneNumber,
        signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || 'LibreChat',
        templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE,
        templateParam: JSON.stringify({ code })
      });

      const response = await client.sendSmsWithOptions(sendSmsRequest, runtime);
      
      if (response.body.code !== 'OK') {
        throw new Error(`Alibaba SMS error: ${response.body.message}`);
      }
      
      return {
        success: true,
        messageId: response.body.bizId,
        provider: SMS_PROVIDER.ALIBABA,
        details: response.body
      };
    }
  } catch (error) {
    logger.error('[SMSService] Failed to send verification code:', error);
    throw new Error('Failed to send verification code');
  }
};

/**
 * Sends a notification SMS
 * @param {Object} params Parameters for sending the notification
 * @param {string} params.phoneNumber The phone number to send to
 * @param {string} params.message The message to send
 * @param {Object} [params.templateParams] Template parameters for Alibaba Cloud
 * @returns {Promise<Object>} The result of the SMS sending operation
 */
const sendNotification = async ({ phoneNumber, message, templateParams }) => {
  try {
    logger.info(`[SMSService] Sending notification to ${phoneNumber}`);

    if (SMS_PROVIDER_TYPE === SMS_PROVIDER.MOCK) {
      logger.info(`[MOCK SMS] Notification to ${phoneNumber}: ${message}`);
      console.log(`📱 MOCK SMS NOTIFICATION: Phone: ${phoneNumber}, Message: ${message}`);
      return {
        success: true,
        mode: 'mock',
        messageId: 'mock-' + Date.now()
      };
    }

    const client = createClient();

    if (SMS_PROVIDER_TYPE === SMS_PROVIDER.ALIBABA) {
      const runtime = new Util.RuntimeOptions({});
      const sendSmsRequest = new Dysmsapi20170525.SendSmsRequest({
        phoneNumbers: phoneNumber,
        signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || 'LibreChat',
        templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE_NOTIFICATION,
        templateParam: JSON.stringify(templateParams || { message })
      });

      const response = await client.sendSmsWithOptions(sendSmsRequest, runtime);
      
      if (response.body.code !== 'OK') {
        throw new Error(`Alibaba SMS error: ${response.body.message}`);
      }
      
      return {
        success: true,
        messageId: response.body.bizId,
        provider: SMS_PROVIDER.ALIBABA,
        details: response.body
      };
    }
  } catch (error) {
    logger.error('[SMSService] Failed to send notification:', error);
    throw new Error('Failed to send notification');
  }
};

module.exports = {
  sendVerificationCode,
  sendNotification,
  SMS_PROVIDER,
  SMS_PROVIDER_TYPE
};
