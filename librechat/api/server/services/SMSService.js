const Core = require('@alicloud/pop-core'); // Aliyun SDK
const { logger } = require('~/config');

class SMSService {
  constructor() {
    this.client = new Core({
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25'
    });
  }

  async sendVerificationCode(phoneNumber, code) {
    try {
      const params = {
        PhoneNumbers: phoneNumber,
        SignName: process.env.ALIYUN_SMS_SIGN_NAME,
        TemplateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
        TemplateParam: JSON.stringify({ code })
      };

      const result = await this.client.request('SendSms', params, { method: 'POST' });
      return result;
    } catch (error) {
      logger.error('[SMSService] Send verification code error:', error);
      throw error;
    }
  }
}

module.exports = new SMSService();

