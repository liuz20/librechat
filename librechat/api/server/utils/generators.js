/**
 * Utility functions for generating various codes and tokens
 */

/**
 * Generates a random numeric verification code
 * @param {number} length - The length of the verification code. Default is 6 digits.
 * @returns {string} A random numeric verification code
 */
const generateVerificationCode = (length = 6) => {
  // Generate a random number with the specified number of digits
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  
  // Generate a random integer between min and max (inclusive)
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Convert to string and return
  return code.toString();
};

module.exports = {
  generateVerificationCode
};

