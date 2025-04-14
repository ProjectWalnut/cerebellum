const { StageError } = require('../utils/errors');

class Stage {
  /**
   * @param {string} name - Name of the stage.
   * @param {Array<Task>} tasks - Array of Task instances to run.
   * @param {Function|null} callback - Callback to process the final output.
   * @param {string} mode - Mode to execute tasks: "parallel" or "conditional". Default is "parallel".
   * @param {Function|null} nextTasks - (For conditional mode) Function that returns the next Task instance(s) based on the context.
   */
  constructor(name, tasks = [], callback = null, mode = "parallel", nextTasks = null) {
    this.name = name;
    this.tasks = tasks;
    this.callback = callback;
    this.mode = mode;
    this.nextTasks = nextTasks; // used only in conditional mode
  }

  /**
   * Runs the stage based on the selected mode.
   * @param {Object} context - The standardized context passed from the job.
   * @returns {Object} Updated context after stage execution.
   */
  async run(context) {
    try {
      switch (this.mode) {
        case "parallel":
          return await this.runParallel(context);
        case "conditional":
          return await this.runConditional(context);
        default:
          throw new Error(`Unknown mode: ${this.mode}`);
      }
    } catch (error) {
      throw new StageError(this.name, error);
    }
  }

  // Parallel mode: run all tasks concurrently on the same context.
  async runParallel(context) {
    let results = await Promise.all(this.tasks.map(task => task.run(context)));
    context.previous = results;
    context.history.push(results);
    results = this.callback ? await this.callback(context) : context;
    context.previous = results;
    context.history.push(results);
    return context;
  }

  // Conditional mode: continuously invoke nextTasks until an empty array is returned.
  async runConditional(context) {
    if (typeof this.nextTasks !== 'function') {
      throw new Error("Conditional mode requires a nextTasks function in the stage definition.");
    }
    while (true) {
      let next = this.nextTasks(context);
      let nextTaskArr = Array.isArray(next) ? next : [next];
      if (nextTaskArr.length === 0) break;
      let outputs = await Promise.all(nextTaskArr.map(task => task.run(context)));
      context.previous = outputs;
      context.history.push(outputs);
    }
    let results = this.callback ? await this.callback(context) : context;
    context.previous = results;
    context.history.push(results);
    return context;
  }
}

module.exports = Stage;
