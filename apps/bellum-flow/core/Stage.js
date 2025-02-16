// src/stages/Stage.js

const { StageError } = require('../utils/errors');
``
class Stage {
  /**
   * @param {string} name - Name of the stage.
   * @param {Array<Task>} tasks - Array of Task instances to run.
   * @param {Function} callback - Callback to process the results from the tasks.
   */
  constructor(name, tasks = [], callback = null) {
    this.name = name;
    this.tasks = tasks;
    this.callback = callback;
  }

  async run(input) {
    try {
      // Run all tasks in parallel.
      const results = await Promise.all(this.tasks.map(task => task.run(input)));
      let output = results;
      if (this.callback) {
        output = await this.callback(results);
      }
      return output;
    } catch (error) {
      throw new StageError(this.name, error);
    }
  }
}

module.exports = Stage;
