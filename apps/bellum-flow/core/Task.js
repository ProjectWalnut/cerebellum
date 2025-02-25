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
    // Use provided retry options or fall back to the ones in configuration.
    this.retryOptions = options.retryOptions || configManager.getConfig().retryOptions;
    this.fallbackFn = options.fallbackFn || null;
    // Capture optional input/output schemas if defined on the task function.
    this.inputSchema = taskFn.inputSchema || null;
    this.outputSchema = taskFn.outputSchema || null;
  }

  async run(input) {
    try {
      // Validate input if an input schema is defined.
      if (this.inputSchema) {
        const validationResult = validateInput(input, this.inputSchema);
        if (!validationResult.valid) {
          throw new Error(`Task "${this.name}" input validation error: ${validationResult.message}`);
        }
      }

      let result;
      if (this.retryOptions) {
        result = await withRetry(this.taskFn, input, this.retryOptions);
      } else {
        result = await this.taskFn(input);
      }

      // Validate output if an output schema is defined.
      if (this.outputSchema) {
        const validationResult = validateInput(result, this.outputSchema);
        if (!validationResult.valid) {
          throw new Error(`Task "${this.name}" output validation error: ${validationResult.message}`);
        }
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
