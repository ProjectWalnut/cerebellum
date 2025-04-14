const withRetry = require('../utils/retryHelper');
const { TaskError } = require('../utils/errors');
const configManager = require('../../../core/config-manager/configManager');
const validateInput = require('../utils/validateInput'); // <-- Added for schema validation

class Task {
  /**
   * @param {string} name - Name of the task.
   * @param {Function} taskFn - The asynchronous function representing the task.
   * @param {Object} options - Options including retryOptions and fallbackFn.
   */
  constructor(name, taskFn, options = {}) {
    this.name = name;
    this.taskFn = taskFn;
    // Use provided retry options or fallback to configuration options.
    this.retryOptions = options.retryOptions || configManager.getConfig().retryOptions;
    this.fallbackFn = options.fallbackFn || null;
    // Capture optional input/output schemas if defined on the task function.
    this.inputSchema = taskFn.inputSchema || null;
    this.outputSchema = taskFn.outputSchema || null;
  }

  async run(input) {
    try {
      // If the input is a standardized context (from Job/Stage), extract the payload.
      const payload = (input && typeof input === 'object' && input.hasOwnProperty('previous'))
        ? input.previous
        : input;

      // Validate the payload if an input schema is defined.
      if (this.inputSchema) {
        const validationResult = validateInput(payload, this.inputSchema);
        if (!validationResult.valid) {
          throw new Error(`Task "${this.name}" input validation error: ${validationResult.message}`);
        }
      }

      let result;
      if (this.retryOptions) {
        result = await withRetry(this.taskFn, payload, this.retryOptions);
      } else {
        result = await this.taskFn(payload);
      }

      // Validate the output if an output schema is defined.
      if (this.outputSchema) {
        const validationResult = validateInput(result, this.outputSchema);
        if (!validationResult.valid) {
          throw new Error(`Task "${this.name}" output validation error: ${validationResult.message}`);
        }
      }

      return result;
    } catch (error) {
      // If a fallback function is provided, attempt it.
      if (this.fallbackFn) {
        try {
          // Pass the same payload and error to the fallback function.
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
