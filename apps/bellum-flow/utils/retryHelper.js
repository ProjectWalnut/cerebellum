// src/utils/retryHelper.js

/**
 * Wraps an async function with retry mechanism.
 * @param {Function} taskFn - The asynchronous task function.
 * @param {*} input - The input for the task function.
 * @param {Object} options - Retry options: { retries: number, delay: number }.
 * @returns {Promise<*>} - The result of the task function.
 */
async function withRetry(taskFn, input, options = { retries: 3, delay: 1000 }) {
    let attempts = 0;
    while (attempts < options.retries) {
      try {
        return await taskFn(input);
      } catch (error) {
        attempts++;
        if (attempts >= options.retries) {
          throw error;
        }
        // Exponential backoff: delay * 2^(attempts-1)
        const waitTime = options.delay * Math.pow(2, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  module.exports = withRetry;
  