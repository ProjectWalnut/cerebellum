const mongoose = require('mongoose');
const Stage = require('./Stage');
const { JobError } = require('../utils/errors');
const appContext = require('../../../core/app-context/appContext');
const validateInput = require('../utils/validateInput');
const Task = require('./Task');

class Job {
  /**
   * @param {string} name - The name of the job.
   * @param {Object} definition - Job definition containing optional inputSchema, preprocessor, and stages.
   */
  constructor(name, definition) {
    this.name = name;
    this.inputSchema = definition.inputSchema;
    this.preprocessor = definition.preprocessor;
    // Convert each stage definition into a Stage instance.
    // Passing along mode and nextTasks if defined.
    this.stages = definition.stages.map((stageDef, index) => {
      const stageName = stageDef.name || `Stage ${index + 1}`;
      const tasks = stageDef.tasks.map(
        taskDef => new Task(taskDef.name, taskDef.fn, { fallbackFn: taskDef.fallbackFn })
      );
      const mode = stageDef.mode || "parallel";
      const nextTasks = stageDef.nextTasks || null;
      return new Stage(stageName, tasks, stageDef.callback, mode, nextTasks);
    });

    // ---------------------------
    // Initialize job logging
    // ---------------------------
    const config = appContext.getConfig();
    // Get the job logging configuration from the config.
    const jobLoggingUri = config.Cerebellum.BellumFlow.mongoUri;
    const jobLoggingCollection = config.Cerebellum.BellumFlow.collection;

    // Create a static connection and model if not already created.
    if (!Job.jobLoggingConnection) {
      // Omit the deprecated options.
      Job.jobLoggingConnection = mongoose.createConnection(jobLoggingUri);
      const jobLogSchema = new mongoose.Schema({
        name: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        // We do log meta information about input and stages.
        // If detailed context logging is enabled, these fields may contain rich data.
        input: mongoose.Schema.Types.Mixed,
        stages: [{
          name: String,
          // We purposely avoid storing large context details if logging is disabled.
          // Only status, timestamps and error messages will be recorded.
          loggedInput: mongoose.Schema.Types.Mixed,
          loggedOutput: mongoose.Schema.Types.Mixed,
          startedAt: Date,
          completedAt: Date,
          is_completed: Boolean,
          error: mongoose.Schema.Types.Mixed
        }],
        finalOutput: mongoose.Schema.Types.Mixed,
        error: mongoose.Schema.Types.Mixed,
        is_completed: Boolean,
        updatedAt: { type: Date, default: Date.now }
      });
      Job.JobLog = Job.jobLoggingConnection.model('JobLog', jobLogSchema, jobLoggingCollection);
    }

    // Create a new job log document and mark it as not completed initially.
    this.jobLogDoc = new Job.JobLog({ name: this.name, is_completed: false });
    this.jobLogDoc.save()
      .then(() => console.log(`Job log created for job: ${this.name}`))
      .catch(err => console.error("Error creating job log:", err));

    // This flag will later be set based on the initial input.
    // When true, detailed context data will be included; otherwise, context details will be omitted.
    this.loggingContext = false;
  }

  /**
   * Updates the job log document using an atomic update.
   * @param {Object} updateFields - Fields to update.
   */
  async updateJobLog(updateFields) {
    if (this.jobLogDoc) {
      // Use findByIdAndUpdate to avoid parallel save issues.
      const updatedDoc = await Job.JobLog.findByIdAndUpdate(
        this.jobLogDoc._id,
        { $set: { ...updateFields, updatedAt: new Date() } },
        { new: true }
      );
      this.jobLogDoc = updatedDoc;
    }
  }

  /**
   * Appends a stage log entry to the job log using an atomic update.
   * @param {Object} stageLog - The log details for the stage.
   */
  async pushStageLog(stageLog) {
    if (this.jobLogDoc) {
      const updatedDoc = await Job.JobLog.findByIdAndUpdate(
        this.jobLogDoc._id,
        {
          $push: { stages: stageLog },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );
      this.jobLogDoc = updatedDoc;
    }
  }

  /**
   * Wraps the raw input into a standardized context.
   * The context contains:
   *   - initial: the raw input
   *   - previous: the most recent output
   *   - history: an array of all outputs (including initial input)
   *   - iteration: current iteration count (useful for conditional mode if needed)
   *   - loggingEnabled: a flag (e.g., input.loggingEnabled) that controls whether detailed I/O is logged
   *
   * @param {*} input - Raw initial input.
   * @returns {Object} The context object.
   */
  createContext(input) {
    return {
      initial: input,
      previous: input,
      history: [input],
      iteration: 0,
      // Expect a flag from the input; default is false (detailed I/O logging off).
      loggingEnabled: input.loggingEnabled || false
    };
  }

  /**
   * Runs the job by executing each stage sequentially.
   * The standardized context flows through each stage.
   * Log entries capture status, timestamps, errors, and completion flags.
   * The detailed context (input/output) is only logged if loggingEnabled is true.
   *
   * @param {*} initialInput - Initial input for the job.
   * @returns {*} The final context after executing all stages.
   */
  async run(initialInput) {
    try {
      // Validate input if an inputSchema is provided.
      if (this.inputSchema) {
        const validationResult = validateInput(initialInput, this.inputSchema);
        if (!validationResult.valid) {
          throw new Error(`Input validation error: ${validationResult.message}`);
        }
      }
      // Preprocess the input if needed.
      if (this.preprocessor) {
        initialInput = await this.preprocessor(initialInput);
      }

      // Create the standardized context and set the detailed logging flag.
      let context = this.createContext(initialInput);
      this.loggingContext = context.loggingEnabled;

      // Log job start.
      await this.updateJobLog({ input: this.loggingContext ? initialInput : "Detailed context logging is disabled." });

      // Process each stage sequentially.
      for (const stage of this.stages) {
        // Prepare a stage log entry.
        const stageLog = {
          name: stage.name,
          startedAt: new Date(),
          is_completed: false,
          // Log details only if detailed logging is enabled.
          loggedInput: this.loggingContext ? context : undefined
        };
        try {
          // Run the stage; each stage returns an updated context.
          let updatedContext = await stage.run(context);

          // Complete stage log.
          stageLog.completedAt = new Date();
          stageLog.is_completed = true;
          stageLog.loggedOutput = this.loggingContext ? updatedContext : undefined;
          stageLog.error = undefined;

          await this.pushStageLog(stageLog);

          // Update the context for the next stage.
          context = updatedContext;
        } catch (stageError) {
          // If a stage fails, record the error.
          stageLog.completedAt = new Date();
          stageLog.is_completed = true;
          stageLog.error = stageError.message;
          stageLog.loggedOutput = this.loggingContext ? "Stage errored before completing output logging." : undefined;
          await this.pushStageLog(stageLog);
          throw stageError;
        }
      }
      // Mark the job as completed.
      await this.updateJobLog({ finalOutput: this.loggingContext ? context : "Detailed output logging is disabled.", is_completed: true });
      return context;
    } catch (error) {
      await this.updateJobLog({ error: error.message });
      throw new JobError(this.name, error);
    }
  }
}

module.exports = Job;
