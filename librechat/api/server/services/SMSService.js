const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');
const { logger } = require('~/config');

/**
 * SMSService provides functionality to send SMS messages using Alibaba Cloud's SMS service.
 * 
 * This service handles SMS operations like sending verification codes and notifications
 * using Alibaba Cloud's SMS API. It manages connection creation, request formatting,
 * and error handling for all SMS operations.
 * 
 * @module SMSService
 */
/**
 * Creates an Alibaba Cloud SMS client using environment credentials.
 * 
 * This function initializes the Alibaba Cloud SMS client with credentials from
 * environment variables. The client is configured to connect to the Alibaba Cloud
 * SMS service endpoint.
 *
 * @returns {Object} Configured Alibaba Cloud SMS client instance
 * @throws {Error} If required credentials are missing in environment variables
 * @throws {Error} If client initialization fails for any reason
 */
const createClient = () => {
  try {
    // Ensure environment variables are set
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
    
    if (!accessKeyId || !accessKeySecret) {
      throw new Error('Missing Alibaba Cloud SMS credentials in environment variables');
    }
    
    const config = new OpenApi.Config({
      accessKeyId,
      accessKeySecret,
    });
    
    // Set the SMS service endpoint
    config.endpoint = process.env.ALIBABA_CLOUD_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';
    return new Dysmsapi20170525(config);
  } catch (error) {
    logger.error('[SMSService.createClient] Failed to create SMS client:', error);
    throw error;
  }
};
/**
 * Sends an SMS message using Alibaba Cloud SMS service.
 * 
 * Core function for sending SMS messages. It handles parameter validation,
 * client initialization, request construction, and error handling.
 *
 * @async
 * @param {Object} params - Parameters for sending the SMS
 * @param {string} params.phoneNumbers - Phone number(s) to send to, can be comma-separated for multiple recipients
 * @param {string} params.signName - SMS signature name (must be pre-approved in Alibaba Cloud console)
 * @param {string} params.templateCode - SMS template code (must be pre-approved in Alibaba Cloud console)
 * @param {Object|string} params.templateParam - Template parameters in JSON format or pre-formatted JSON string
 * @returns {Promise<Object>} The response from the SMS service
 * @throws {Error} If required parameters are missing
 * @throws {Error} If there's an error creating the client or sending the SMS
 */
const sendSMS = async ({ phoneNumbers, signName, templateCode, templateParam }) => {
  if (!phoneNumbers || !signName || !templateCode) {
    const error = new Error('Missing required parameters for sending SMS');
    logger.error('[SMSService.sendSMS] Parameter validation failed:', error);
    throw error;
  }
  
  try {
    const client = createClient();
    const runtime = new Util.RuntimeOptions({});
    
    // Ensure templateParam is a string
    const parsedTemplateParam = typeof templateParam === 'object' 
      ? JSON.stringify(templateParam) 
      : templateParam;
    
    const sendSmsRequest = new Dysmsapi20170525.SendSmsRequest({
      phoneNumbers,
      signName,
      templateCode,
      templateParam: parsedTemplateParam,
    });
    
    logger.info(`[SMSService.sendSMS] Sending SMS to ${phoneNumbers} using template ${templateCode}`);
    const response = await client.sendSmsWithOptions(sendSmsRequest, runtime);
    
    // Check response for potential errors
    if (response && response.body && response.body.code !== 'OK') {
      logger.warn(`[SMSService.sendSMS] SMS service returned non-OK status: ${response.body.code}, message: ${response.body.message}`);
    } else {
      logger.info(`[SMSService.sendSMS] SMS sent successfully to ${phoneNumbers}`);
    }
    
    return response;
  } catch (error) {
    logger.error('[SMSService.sendSMS] Error sending SMS:', error);
    throw error;
  }
};
/**
 * Sends a verification code SMS.
 * 
 * Specialized function for sending verification code SMS messages. It uses configurable
 * default values for sign name and template code, which can be overridden.
 *
 * @async
 * @param {Object} params - Parameters for sending the verification SMS
 * @param {string} params.phoneNumber - Phone number to send to
 * @param {string} params.code - Verification code to send
 * @param {string} [params.signName] - Optional custom sign name (overrides default)
 * @param {string} [params.templateCode] - Optional custom template code (overrides default)
 * @returns {Promise<Object>} The response from the SMS service
 * @throws {Error} If required parameters are missing or if SMS sending fails
 */
const sendVerificationCode = async ({ phoneNumber, code, signName, templateCode }) => {
  if (!phoneNumber || !code) {
    const error = new Error('Missing required parameters for verification code SMS: phoneNumber and code are required');
    logger.error('[SMSService.sendVerificationCode] Parameter validation failed:', error);
    throw error;
  }

  try {
    const defaultSignName = process.env.SMS_SIGN_NAME || 'LibreChat';
    const defaultTemplateCode = process.env.SMS_TEMPLATE_CODE_VERIFICATION || 'SMS_154950909';
    
    logger.info(`[SMSService.sendVerificationCode] Sending verification code to ${phoneNumber}`);
    return await sendSMS({
      phoneNumbers: phoneNumber,
      signName: signName || defaultSignName,
      templateCode: templateCode || defaultTemplateCode,
      templateParam: { code },
    });
  } catch (error) {
    logger.error('[SMSService.sendVerificationCode] Failed to send verification code:', error);
    throw error;
  }
};
/**
 * Sends a notification SMS.
 * 
 * Specialized function for sending notification SMS messages. It supports custom
 * template parameters and uses configurable default values for sign name and template code.
 *
 * @async
 * @param {Object} params - Parameters for sending the notification SMS
 * @param {string} params.phoneNumber - Phone number to send to
 * @param {Object} params.params - Notification parameters to be inserted into the template
 * @param {string} [params.signName] - Optional custom sign name (overrides default)
 * @param {string} [params.templateCode] - Optional custom template code (overrides default)
 * @returns {Promise<Object>} The response from the SMS service
 * @throws {Error} If required parameters are missing or if SMS sending fails
 */
const sendNotification = async ({ phoneNumber, params, signName, templateCode }) => {
  if (!phoneNumber || !params) {
    const error = new Error('Missing required parameters for notification SMS: phoneNumber and params are required');
    logger.error('[SMSService.sendNotification] Parameter validation failed:', error);
    throw error;
  }

  try {
    const defaultSignName = process.env.SMS_SIGN_NAME || 'LibreChat';
    const defaultTemplateCode = process.env.SMS_TEMPLATE_CODE_NOTIFICATION || 'SMS_DEFAULT_NOTIFICATION';
    
    logger.info(`[SMSService.sendNotification] Sending notification to ${phoneNumber}`);
    return await sendSMS({
      phoneNumbers: phoneNumber,
      signName: signName || defaultSignName,
      templateCode: templateCode || defaultTemplateCode,
      templateParam: params,
    });
  } catch (error) {
    logger.error('[SMSService.sendNotification] Failed to send notification:', error);
    throw error;
  }
};
module.exports = {
  createClient,
  sendSMS,
  sendVerificationCode,
  sendNotification
};
