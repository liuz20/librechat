    try {
      await SMSService.sendVerificationCode({ phoneNumber: phone, code });
      logger.info(`Verification code sent to ${phone}`);
      return res.status(200).json({ message: 'Verification code sent successfully' });
    try {
      await SMSService.sendVerificationCode({ phoneNumber: phone, code });
      logger.info(`Verification code sent to ${phone}`);
      return res.status(200).json({ message: 'Verification code sent successfully' });
