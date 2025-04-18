const { JobLog } = require('./jobLogModel');
const { JobError } = require('../utils/errors');
const validateInput = require('../utils/validateInput');
const path = require('path');
const fs = require('fs');
const jobBuilder = require('./JobBuilder');

class Job {
  /**
   * @param {string} name - The name of the job.
   * @param {Object} definition - Fully resolved job definition containing inputSchema, preprocessor, and stages.
   */
  static taskRegistry = null;

  static buildTasksRegistry() {
    const tasksDir = path.join(__dirname, '../tasks');
    const taskFiles = fs.readdirSync(tasksDir);
    const registry = {};
  
    for (let file of taskFiles) {
      if (file.endsWith('.js')) {
        const taskModule = require(path.join(tasksDir, file));
        if (!taskModule.task_name) {
          throw new Error(`Task file "${file}" does not export a "task_name" property.`);
        }
        const taskName = taskModule.task_name.toUpperCase(); // Normalize to uppercase
        registry[taskName] = taskModule;
      }
    }
    return registry;
  }

  /**
   * Async factory: loads or creates the JobLog, then returns an initialized Job
   */
  static async build(name, definition, jobId = null) {
    const instance = new Job(name, definition);
    if (jobId) {
      instance.jobLogDoc = await JobLog.findById(jobId);
    } else {
      instance.jobLogDoc = await JobLog.create({ name: instance.name, is_completed: false });
    }
    return instance;
  }

  constructor(name, definition) {
    this.name = name;
    this.inputSchema = definition.inputSchema;
    this.preprocessor = definition.preprocessor;

    if (!Job.taskRegistry) {
      Job.taskRegistry = Job.buildTasksRegistry();
    }
    this.stages = jobBuilder.buildJobStages(definition, Job.taskRegistry);

    // jobLogDoc will be attached in the async build() above
    this.loggingContext = false;
  }

  async updateJobLog(updateFields) {
    if (this.jobLogDoc) {
      this.jobLogDoc = await JobLog.findByIdAndUpdate(
        this.jobLogDoc._id,
        { $set: { ...updateFields, updatedAt: new Date() } },
        { new: true }
      );
    }
  }

  async pushStageLog(stageLog) {
    if (this.jobLogDoc) {
      this.jobLogDoc = await JobLog.findByIdAndUpdate(
        this.jobLogDoc._id,
        { $push: { stages: stageLog }, $set: { updatedAt: new Date() } },
        { new: true }
      );
    }
  }

  createContext(input) {
    return {
      initial: input,
      previous: input,
      history: [input],
      iteration: 0,
      loggingEnabled: input.loggingEnabled || false
    };
  }

  async run(initialInput) {
    try {
      if (this.inputSchema) {
        const validationResult = validateInput(initialInput, this.inputSchema);
        if (!validationResult.valid) {
          throw new Error(`Input validation error: ${validationResult.message}`);
        }
      }
      if (this.preprocessor) {
        initialInput = await this.preprocessor(initialInput);
      }
      let context = this.createContext(initialInput);
      this.loggingContext = context.loggingEnabled;

      await this.updateJobLog({ input: this.loggingContext ? initialInput : "Detailed context logging is disabled." });

      for (const stage of this.stages) {
        const stageLog = {
          name: stage.name,
          startedAt: new Date(),
          is_completed: false,
          loggedInput: this.loggingContext ? context : undefined
        };
        try {
          let updatedContext = await stage.run(context);
          stageLog.completedAt = new Date();
          stageLog.is_completed = true;
          stageLog.loggedOutput = this.loggingContext ? updatedContext : undefined;
          stageLog.error = undefined;
          await this.pushStageLog(stageLog);
          context = updatedContext;
        } catch (stageError) {
          stageLog.completedAt = new Date();
          stageLog.is_completed = true;
          stageLog.error = stageError.message;
          stageLog.loggedOutput = this.loggingContext ? "Stage errored before completing output logging." : undefined;
          await this.pushStageLog(stageLog);
          throw stageError;
        }
      }
      await this.updateJobLog({ finalOutput: this.loggingContext ? context : "Detailed output logging is disabled.", is_completed: true });
      return context.previous;
    } catch (error) {
      await this.updateJobLog({ error: error.message });
      throw new JobError(this.name, error);
    }
  }
}

module.exports = Job;
