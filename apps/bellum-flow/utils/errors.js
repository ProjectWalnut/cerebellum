// src/utils/errors.js

class TaskError extends Error {
    constructor(taskName, originalError) {
      super(`Task "${taskName}" failed: ${originalError.message}`);
      this.name = "TaskError";
      this.taskName = taskName;
      this.originalError = originalError;
    }
  }
  
  class StageError extends Error {
    constructor(stageName, originalError) {
      super(`Stage "${stageName}" failed: ${originalError.message}`);
      this.name = "StageError";
      this.stageName = stageName;
      this.originalError = originalError;
    }
  }
  
  class JobError extends Error {
    constructor(jobName, originalError) {
      super(`Job "${jobName}" failed: ${originalError.message}`);
      this.name = "JobError";
      this.jobName = jobName;
      this.originalError = originalError;
    }
  }
  
  module.exports = {
    TaskError,
    StageError,
    JobError
  };
  