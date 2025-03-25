# Phone Authentication Implementation Plan (Aliyun SMS Integration)

This document outlines the implementation plan for adding phone number-based authentication to LibreChat, specifically designed for the Chinese market using Aliyun's SMS service for verification.

## 1. User Schema Updates

Modify the user schema to include phone number support:

```typescript
// In packages/data-schemas/src/schema/user.ts
export interface IUser extends Document {
  // Existing fields...
  phoneNumber?: string;
  phoneVerified: boolean;
  // Other fields...
}

const User = new Schema<IUser>(
  {
    // Existing fields...
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // Other fields...
  },
  { timestamps: true },
);
```

## 2. SMS Verification Service

Create a new service for Aliyun SMS integration:

```javascript
// api/server/services/SMSService.js
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
```

## 3. Validation Schema Updates

Add phone number validation to the validation schemas:

```javascript
// api/strategies/validators.js
const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format

const phoneLoginSchema = z.object({
  phoneNumber: z.string().regex(phoneRegex, { message: "Invalid phone number format" }),
  password: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => value.trim().length > 0, {
      message: 'Password cannot be only spaces',
    }),
});

const phoneRegisterSchema = z
  .object({
    name: z.string().min(3).max(80),
    username: z
      .union([z.literal(''), usernameSchema])
      .transform((value) => (value === '' ? null : value))
      .optional()
      .nullable(),
    phoneNumber: z.string().regex(phoneRegex, { message: "Invalid phone number format" }),
    password: z
      .string()
      .min(8)
      .max(128)
      .refine((value) => value.trim().length > 0, {
        message: 'Password cannot be only spaces',
      }),
    confirm_password: z
      .string()
      .min(8)
      .max(128)
      .refine((value) => value.trim().length > 0, {
        message: 'Password cannot be only spaces',
      }),
  })
  .superRefine(({ confirm_password, password }, ctx) => {
    if (confirm_password !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'The passwords did not match',
      });
    }
  });

module.exports = {
  // ... existing schemas
  phoneLoginSchema,
  phoneRegisterSchema,
};
```

## 4. Phone Authentication Controllers

Add controllers for phone verification, registration, and login:

```javascript
// api/server/controllers/PhoneAuthController.js
const User = require('~/models/User');
const SMSService = require('~/server/services/SMSService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { logger } = require('~/config');

// Store verification codes temporarily (in production, use Redis)
const verificationCodes = new Map();

const sendVerificationCodeController = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration (5 minutes)
    verificationCodes.set(phoneNumber, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    
    // Send SMS
    await SMSService.sendVerificationCode(phoneNumber, code);
    
    return res.status(200).json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('[sendVerificationCodeController]', error);
    return res.status(500).json({ message: 'Failed to send verification code' });
  }
};

const verifyPhoneController = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    const storedData = verificationCodes.get(phoneNumber);
    
    if (!storedData || storedData.code !== code || Date.now() > storedData.expiresAt) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    
    // Clean up after successful verification
    verificationCodes.delete(phoneNumber);
    
    return res.status(200).json({ message: 'Phone number verified' });
  } catch (error) {
    logger.error('[verifyPhoneController]', error);
    return res.status(500).json({ message: 'Failed to verify phone number' });
  }
};

const phoneRegistrationController = async (req, res) => {
  try {
    const { name, username, phoneNumber, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }
    
    // Create user
    const user = new User({
      name,
      username,
      phoneNumber,
      phoneVerified: true,
      password, // This will be hashed by pre-save hook in User model
      provider: 'local'
    });
    
    await user.save();
    
    const { password: _p, __v, ...userWithoutSensitiveInfo } = user.toObject();
    userWithoutSensitiveInfo.id = user._id.toString();
    
    const token = await setAuthTokens(user._id, res);
    
    return res.status(200).json({ token, user: userWithoutSensitiveInfo });
  } catch (error) {
    logger.error('[phoneRegistrationController]', error);
    return res.status(500).json({ message: 'Failed to register user' });
  }
};

const phoneLoginController = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    
    const user = await User.findOne({ phoneNumber });
    
    if (!user || !await user.comparePassword(password)) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    if (user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }
    
    const { password: _p, totpSecret: _t, __v, ...userWithoutSensitiveInfo } = user.toObject();
    userWithoutSensitiveInfo.id = user._id.toString();
    
    const token = await setAuthTokens(user._id, res);
    
    return res.status(200).json({ token, user: userWithoutSensitiveInfo });
  } catch (error) {
    logger.error('[phoneLoginController]', error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  sendVerificationCodeController,
  verifyPhoneController,
  phoneRegistrationController,
  phoneLoginController
};
```

## 5. Route Updates

Add new routes for phone authentication:

```javascript
// api/server/routes/auth.js
const {
  sendVerificationCodeController,
  verifyPhoneController,
  phoneRegistrationController,
  phoneLoginController
} = require('~/server/controllers/PhoneAuthController');

const { validatePhoneRegistration, validatePhoneLogin } = require('~/server/middleware');

// Add these routes to the existing router
router.post('/send-verification-code', sendVerificationCodeController);
router.post('/verify-phone', verifyPhoneController);
router.post(
  '/phone-register',
  registerLimiter,
  checkBan,
  checkInviteUser,
  validatePhoneRegistration,
  phoneRegistrationController
);
router.post(
  '/phone-login',
  loginLimiter,
  checkBan,
  validatePhoneLogin,
  phoneLoginController
);
```

## 6. Middleware Updates

Add validation middleware for phone authentication:

```javascript
// In middleware/index.js
const { phoneLoginSchema, phoneRegisterSchema } = require('~/strategies/validators');

const validatePhoneRegistration = (req, res, next) => {
  try {
    phoneRegisterSchema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({ message: error.errors });
  }
};

const validatePhoneLogin = (req, res, next) => {
  try {
    phoneLoginSchema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({ message: error.errors });
  }
};

module.exports = {
  // existing exports...
  validatePhoneRegistration,
  validatePhoneLogin,
};
```

## 7. Frontend Components

Create React components for phone authentication:

### Phone Registration Component

```jsx
// client/src/components/Auth/PhoneRegistration.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

import {
  useSendVerificationCodeMutation,
  useVerifyPhoneMutation,
  usePhoneRegisterMutation
} from '~/data-provider';

import AuthLayout from './AuthLayout';

const PhoneRegistration = () => {
  const [step, setStep] = useState('send-code'); // 'send-code', 'verify-code', 'register'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  const navigate = useNavigate();
  
  const [sendCode, { isLoading: isSendingCode }] = useSendVerificationCodeMutation();
  const [verifyCode, { isLoading: isVerifying }] = useVerifyPhoneMutation();
  const [registerUser, { isLoading: isRegistering }] = usePhoneRegisterMutation();
  
  // Form setup and handlers for each step
  // ...

  return (
    <AuthLayout>
      {/* Step-specific forms and UI */}
    </AuthLayout>
  );
};

export default PhoneRegistration;
```

### Phone Login Component

```jsx
// client/src/components/Auth/PhoneLogin.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

import { usePhoneLoginMutation } from '~/data-provider';
import AuthLayout from './AuthLayout';

const PhoneLogin = () => {
  const navigate = useNavigate();
  
  const [loginUser, { isLoading }] = usePhoneLoginMutation();
  
  // Form setup and handlers
  // ...

  return (
    <AuthLayout>
      {/* Login form */}
    </AuthLayout>
  );
};

export default PhoneLogin;
```

## 8. API Client Updates

Add new API endpoints to the data provider:

```typescript
// client/src/data-provider/index.ts

// Add these to the existing API definitions
sendVerificationCode: builder.mutation({
  query: (credentials) => ({
    url: 'auth/send-verification-code',
    method: 'POST',
    body: credentials,
  }),
}),
verifyPhone: builder.mutation({
  query: (credentials) => ({
    url: 'auth/verify-phone',
    method: 'POST',
    body: credentials,
  }),
}),
phoneRegister: builder.mutation({
  query: (credentials) => ({
    url: 'auth/phone-register',
    method: 'POST',
    body: credentials,
  }),
}),
phoneLogin: builder.mutation({
  query: (credentials) => ({
    url: 'auth/phone-login',
    method: 'POST',
    body: credentials,
  }),
}),
```

## 9. Environment Configuration

Add new environment variables to the `.env` file:

```
# Aliyun SMS Configuration
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_SMS_SIGN_NAME=your_sign_name
ALIYUN_SMS_TEMPLATE_CODE=your_template_code
```

## 10. Dependencies

Install necessary npm packages:

```bash
npm install @alicloud/pop-core --save
```

## 11. Future Improvements

1. **Security Enhancements**:
   - Implement rate limiting for SMS verification requests
   - Use Redis for securely storing verification codes
   - Add IP-based restrictions for verification attempts

2. **User Experience**:
   - Add account recovery via phone number
   - Implement phone number change functionality for existing users
   - Add internationalization support for Chinese language

3. **Testing**:
   - Add unit tests for phone authentication endpoints
   - Add integration tests for the entire authentication flow
   - Create test mocks for the Aliyun SMS service

4. **Documentation**:
   - Update API documentation to include phone authentication endpoints
   - Add Chinese translations for error messages and UI text
   - Create user guides for the new phone authentication flow

## 12. Testing and Verification

This section provides detailed steps for testing the phone authentication implementation.

### Environment Setup

1. Configure the required environment variables in your `.env` file:
   ```
   # Phone Authentication Enablement
   ALLOW_PHONE_LOGIN=true
   ALLOW_PHONE_REGISTRATION=true

   # Aliyun SMS Configuration
   ALIYUN_ACCESS_KEY_ID=your_access_key_id
   ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
   ALIYUN_SMS_SIGN_NAME=your_sign_name
   ALIYUN_SMS_TEMPLATE_CODE=your_template_code
   ```

2. If using Redis for verification code storage in production:
   ```
   REDIS_URI=your_redis_connection_string
   ```

### Verification Steps

#### Backend Testing

1. **Test SMS Service**:
   ```bash
   curl -X POST http://localhost:3080/api/auth/send-verification-code \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+86XXXXXXXXXX"}'
   ```
   - Verify you receive a success response
   - Check that SMS is received on the target phone

2. **Test Phone Verification**:
   ```bash
   curl -X POST http://localhost:3080/api/auth/verify-phone \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+86XXXXXXXXXX", "code": "123456"}'
   ```
   - Use the actual verification code received
   - Verify success/failure responses

3. **Test Phone Registration**:
   ```bash
   curl -X POST http://localhost:3080/api/auth/phone-register \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "username": "testuser", "phoneNumber": "+86XXXXXXXXXX", "password": "password123", "confirm_password": "password123"}'
   ```
   - Verify user creation in database
   - Check phoneVerified flag is true

4. **Test Phone Login**:
   ```bash
   curl -X POST http://localhost:3080/api/auth/phone-login \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+86XXXXXXXXXX", "password": "password123"}'
   ```
   - Verify authentication token is returned

#### Frontend Testing

1. **Navigation Testing**:
   - Verify login page shows "Login with Phone Number" link
   - Verify registration page shows "Sign up with Phone Number" link
   - Test navigation between different auth pages

2. **Phone Registration Flow**:
   - Enter phone number and request verification code
   - Verify code delivery (check if SMS is received)
   - Enter verification code
   - Complete registration with user details
   - Verify successful registration and redirect

3. **Phone Login Flow**:
   - Enter phone number and password
   - Verify successful login and redirect
   - Test with incorrect credentials to verify error handling

4. **Phone Verification Process**:
   - Test code expiration (wait > 5 minutes)
   - Test incorrect code entry
   - Test resending verification code

### Edge Cases to Test

1. **Phone Number Format**:
   - Test various international formats
   - Test invalid phone numbers
   - Test Chinese mainland numbers specifically

2. **Verification Code**:
   - Test with expired codes
   - Test with incorrect codes
   - Test rate limiting for code requests

3. **User Registration**:
   - Test registering with already registered phone number
   - Test weak passwords and validation errors
   - Test username uniqueness constraints

4. **Login Issues**:
   - Test login with unverified phone numbers
   - Test account lockout after multiple failed attempts
   - Test 2FA flow if enabled

### Performance Testing

1. **SMS Delivery**:
   - Measure average delivery time
   - Test under load with multiple requests

2. **Verification Storage**:
   - Test with in-memory storage vs. Redis
   - Compare performance and reliability

### Security Testing

1. **Input Validation**:
   - Test with SQL injection attempts in phone fields
   - Test with XSS attempts in user fields

2. **Rate Limiting**:
   - Test bypassing rate limits
   - Verify IP-based restrictions work

3. **Token Security**:
   - Verify auth tokens have proper expiration
   - Test token revocation on logout

### Production Readiness Checklist

- [ ] All environment variables properly configured
- [ ] Redis configured for verification code storage
- [ ] Rate limiting properly set up
- [ ] Aliyun SMS account has sufficient balance
- [ ] Error logging and monitoring in place
- [ ] Chinese translations complete
- [ ] Mobile responsive UI tested
- [ ] Load testing completed successfully

With these testing steps, you should be able to thoroughly verify your phone authentication implementation before deploying to production.
