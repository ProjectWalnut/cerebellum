const mongoose = require('mongoose');
const Stage = require('./Stage');
const { JobError } = require('../utils/errors');
const appContext = require('../../../core/app-context/appContext');
const validateInput = require('../utils/validateInput');

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
    this.stages = definition.stages.map((stageDef, index) => {
      const stageName = stageDef.name || `Stage ${index + 1}`;
      const Task = require('./Task');
      const tasks = stageDef.tasks.map(
        taskDef => new Task(taskDef.name, taskDef.fn, { fallbackFn: taskDef.fallbackFn })
      );
      return new Stage(stageName, tasks, stageDef.callback);
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
        input: mongoose.Schema.Types.Mixed,
        stages: [{
          name: String,
          input: mongoose.Schema.Types.Mixed,
          output: mongoose.Schema.Types.Mixed,
          error: mongoose.Schema.Types.Mixed,
          startedAt: Date,
          completedAt: Date
        }],
        finalOutput: mongoose.Schema.Types.Mixed,
        error: mongoose.Schema.Types.Mixed,
        updatedAt: { type: Date, default: Date.now }
      });
      // Use the collection name provided in the config.
      Job.JobLog = Job.jobLoggingConnection.model('JobLog', jobLogSchema, jobLoggingCollection);
    }

    // Create a new job log document for this job.
    this.jobLogDoc = new Job.JobLog({ name: this.name });
    this.jobLogDoc.save()
      .then(() => console.log(`Job log created for job: ${this.name}`))
      .catch(err => console.error("Error creating job log:", err));
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
   * Runs the job by executing each stage sequentially.
   * Logs inputs, outputs, and errors into the job log.
   * @param {*} initialInput - Initial input for the job.
   * @returns {*} Final output after executing all stages.
   */
  async run(initialInput) {
    try {
      // Validate raw input if inputSchema is defined.
      if (this.inputSchema) {
        const validationResult = validateInput(initialInput, this.inputSchema);
        if (!validationResult.valid) {
          throw new Error(`Input validation error: ${validationResult.message}`);
        }
      }
      // Preprocess input if a preprocessor function is provided.
      if (this.preprocessor) {
        initialInput = await this.preprocessor(initialInput);
      }

      await this.updateJobLog({ input: initialInput });

      let input = { ...initialInput, __initialInput: initialInput };
      for (const stage of this.stages) {
        // Prepare a log entry for this stage.
        let stageLog = { name: stage.name, input: input, startedAt: new Date() };
        try {
          // Execute the stage.
          let stageOutput = await stage.run(input);
          stageLog.output = stageOutput;
          stageLog.completedAt = new Date();
          await this.pushStageLog(stageLog);
          input = { ...stageOutput, __initialInput: initialInput };    // Update stageOutput as input to the next stage
        } catch (stageError) {
          stageLog.error = stageError.message;
          stageLog.completedAt = new Date();
          await this.pushStageLog(stageLog);
          throw stageError;
        }
      }
      // Log the final output.
      await this.updateJobLog({ finalOutput: input });
      return input;
    } catch (error) {
      await this.updateJobLog({ error: error.message });
      throw new JobError(this.name, error);
    }
  }
}

module.exports = Job;
