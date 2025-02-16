// src/tasks/Task.js

const withRetry = require('../utils/retryHelper');
const { TaskError } = require('../utils/errors');
const configManager = require('../../../core/config-manager/configManager');

class Task {
  /**
   * @param {string} name - Name of the task.
   * @param {Function} taskFn - The asynchronous function representing the task.
   * @param {Object} options - Options including retryOptions and fallbackFn.
   */
  constructor(name, taskFn, options = {}) {
    this.name = name;
    this.taskFn = taskFn;
    // Use provided retry options or fall back to the ones in configuration.
    this.retryOptions = options.retryOptions || configManager.getConfig().retryOptions;
    this.fallbackFn = options.fallbackFn || null;
  }

  async run(input) {
    try {
      let result;
      if (this.retryOptions) {
        result = await withRetry(this.taskFn, input, this.retryOptions);
      } else {
        result = await this.taskFn(input);
      }
      return result;
    } catch (error) {
      // Execute fallback if provided
      if (this.fallbackFn) {
        try {
          return await this.fallbackFn(input, error);
        } catch (fallbackError) {
          throw new TaskError(this.name, fallbackError);
        }
      }
      throw new TaskError(this.name, error);
    }
  }
}

module.exports = Task;
