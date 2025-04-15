// src/utils/retryHelper.js

/**
 * Wraps an async function with a retry mechanism.
 * @param {Function} taskFn - The asynchronous task function.
 * @param {*} input - The input (or context) for the task function.
 * @param {Object} options - Retry options: { retries: number, delay: number }.
 * @param {*} [args] - Optional extra parameters to be forwarded to taskFn.
 * @returns {Promise<*>} - The result of the task function.
 */
async function withRetry(taskFn, input, options = { retries: 3, delay: 1000 }, args) {
  let attempts = 0;
  while (attempts < options.retries) {
    try {
      // If additional arguments (args) exist, forward them to taskFn
      if (args !== undefined) {
        return await taskFn(input, args);
      } else {
        return await taskFn(input);
      }
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
