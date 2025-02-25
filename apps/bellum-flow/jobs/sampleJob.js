const Tasks = require("../enums/taskEnums");

// Write your callbacks here in the job itself since they belong only to a job
const aggregateCallback = async (results) => {
  // Example aggregation: sum all results
  output = {
    number: 0
  };
  for(let i = 0; i < results.length; i++) {
    output.number += results[i].number;
  }
  return output;
};

const passthroughCallback = (results) => {
  // Simply pass through the first result
  return results[0];
};

// Job name for identification
const job_name = "sample_job";

/**
 * Job Definition:
 *
 * - inputSchema: Describes the raw input expected (for simple validation).
 * - preprocessor: Optionally transforms the raw input before it’s passed to tasks.
 * - stages: An array of stage definitions.
 *    - Tasks can be simply specified as a TaskEnum value (e.g., TaskEnum.INCREMENT).
 *    - If a task requires a fallback, define it as an object: { fn: TaskEnum.DOUBLE, fallbackFn: TaskEnum.DOUBLE }.
 * - `callback`: A mandatory function (direct reference) to process the results of that stage.
 *
 */
const job_definition = {
  inputSchema: {
    required: ['number'],
    properties: {
      number: { type: 'number' }
    }
  },
  // Preprocessor to normalize the input (e.g. ensure the number is positive)
  preprocessor: (rawInput) => {
    return { number: Math.abs(rawInput.number) };
  },
  stages: [
    {
      tasks: [
        // Simple task (no fallback needed)
        Tasks.INCREMENT,
        // Task with a fallback function defined – use this object format ONLY if fallback is needed
        { fn: Tasks.DOUBLE, fallbackFn: Tasks.FALLBACK_FOR_DOUBLE }
      ],
      callback: aggregateCallback
    },
    {
      tasks: [
        Tasks.DECREMENT
      ],
      callback: passthroughCallback
    }
  ]
};

const job_description = `This job, named 'sample_job', is designed to help users adjust numerical values in a structured, multi-step process. It processes input numbers by first increasing them by a fixed amount, then doubling them, and finally reducing them by another fixed amount. If the doubling step fails, the job skips it and keeps the original value. The results of each step are combined to produce the final output. 

The job is built as a modular workflow with two stages:
1. **Stage 1:**  
   - The 'Increment' task increases the input value by a predefined amount.  
   - The 'Double' task multiplies the input value by 2. If this task fails, a fallback function ensures the original value is preserved.  
   - The results of these tasks are combined using an aggregation function.

2. **Stage 2:**  
   - The 'Decrement' task reduces the value by a predefined amount.  
   - The final result is returned as the output of the job.

This job is implemented in a Node.js environment and uses modular tasks for flexibility. It is ideal for automating numerical data processing workflows, handling errors gracefully, and performing structured transformations. Keywords for similarity search include: adjust numbers, increase, double, decrease, structured workflow, error handling, fallback, numerical processing, modular tasks, and multi-step transformation.`;

module.exports = {
  job_definition,
  job_name,
  job_description
};
