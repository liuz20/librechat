const { createClient } = require('redis');
const logger = require('../../config/logger');

// In-memory storage for development mode
const memoryStorage = new Map();

// Initialize Redis client for production
let redisClient = null;

if (process.env.NODE_ENV === 'production') {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });

  redisClient.connect().catch((err) => {
    logger.error('Failed to connect to Redis', err);
  });
}

/**
 * Save a verification code to storage
 * @param {string} phoneNumber - The phone number to associate with the code
 * @param {string} code - The verification code
 * @param {number} expirationSeconds - Time in seconds until the code expires (default: 300 seconds / 5 minutes)
 * @returns {Promise<boolean>} - True if saved successfully, false otherwise
 */
const saveVerificationCodeToStorage = async (phoneNumber, code, expirationSeconds = 300) => {
  try {
    const data = {
      code,
      createdAt: Date.now(),
      expiresAt: Date.now() + (expirationSeconds * 1000)
    };

    // Use Redis in production, memory storage in development
    if (process.env.NODE_ENV === 'production' && redisClient && redisClient.isReady) {
      await redisClient.set(
        `sms:verification:${phoneNumber}`, 
        JSON.stringify(data),
        { EX: expirationSeconds }
      );
    } else {
      // For development: store in memory with manual expiration
      memoryStorage.set(phoneNumber, data);
      
      // Set up automatic expiration for in-memory storage
      setTimeout(() => {
        if (memoryStorage.get(phoneNumber)?.code === code) {
          memoryStorage.delete(phoneNumber);
        }
      }, expirationSeconds * 1000);
    }
    
    return true;
  } catch (error) {
    logger.error('[saveVerificationCodeToStorage]', error);
    return false;
  }
};

/**
 * Retrieve a verification code from storage
 * @param {string} phoneNumber - The phone number to retrieve the code for
 * @returns {Promise<string|null>} - The verification code or null if not found or expired
 */
const getVerificationCodeFromStorage = async (phoneNumber) => {
  try {
    let data;
    
    // Use Redis in production, memory storage in development
    if (process.env.NODE_ENV === 'production' && redisClient && redisClient.isReady) {
      const result = await redisClient.get(`sms:verification:${phoneNumber}`);
      if (!result) return null;
      data = JSON.parse(result);
    } else {
      // For development: retrieve from memory
      data = memoryStorage.get(phoneNumber);
      if (!data) return null;
      
      // Check if code has expired for in-memory storage
      if (Date.now() > data.expiresAt) {
        memoryStorage.delete(phoneNumber);
        return null;
      }
    }
    
    return data.code;
  } catch (error) {
    logger.error('[getVerificationCodeFromStorage]', error);
    return null;
  }
};

/**
 * Delete a verification code from storage
 * @param {string} phoneNumber - The phone number whose code should be deleted
 * @returns {Promise<boolean>} - True if deleted successfully, false otherwise
 */
const deleteVerificationCodeFromStorage = async (phoneNumber) => {
  try {
    // Use Redis in production, memory storage in development
    if (process.env.NODE_ENV === 'production' && redisClient && redisClient.isReady) {
      await redisClient.del(`sms:verification:${phoneNumber}`);
    } else {
      // For development: delete from memory
      memoryStorage.delete(phoneNumber);
    }
    
    return true;
  } catch (error) {
    logger.error('[deleteVerificationCodeFromStorage]', error);
    return false;
  }
};

/**
 * Clean up and close Redis connection when the process terminates
 */
const cleanup = async () => {
  if (redisClient && redisClient.isReady) {
    await redisClient.quit();
  }
};

// Handle process termination gracefully
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  saveVerificationCodeToStorage,
  getVerificationCodeFromStorage,
  deleteVerificationCodeFromStorage
};

