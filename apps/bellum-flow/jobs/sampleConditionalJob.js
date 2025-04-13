const Tasks = require("../enums/taskEnums");

// Callbacks defined for this job.
// aggregateCallback sums the "number" field from each task result.
const aggregateCallback = async (context) => {
  const output = { number: 0 };
  for (let i = 0; i < context.previous.length; i++) {
    output.number += context.previous[i].number;
  }
  return output;
};

// passthroughCallback returns the first task's result.
const passthroughCallback = (context) => {
  return context.previous[0];
};

// The job name for identification.
const job_name = "sample_conditional_job";

/**
 * Job Definition:
 *
 * - inputSchema: Describes the raw input expected (for simple validation).
 *   In this case, we require a "number" field.
 * - preprocessor: Transforms the raw input before tasks receive it.
 *   Here we ensure the number is positive and propagate a `loggingEnabled` flag.
 * - stages: An array of stage definitions.
 *    * Stage 1 runs in "parallel" mode:  
 *       - It contains tasks to increment and then double the value.
 *       - Its results are aggregated via aggregateCallback.
 *
 *    * Stage 2 now runs in "conditional" mode:  
 *       - It contains a single decrement task.
 *       - The nextTasks function returns the decrement task repeatedly as long as the
 *         current value (context.previous.number) is above 10.
 *       - Once the value is less than or equal to 10, it returns an empty array to stop the iterations.
 *       - The passthroughCallback passes through the final result.
 *
 * Detailed I/O logging will only record the full context if the initial input includes 
 * a truthy "loggingEnabled" flag; otherwise, only minimal log meta-information is recorded.
 */
const job_definition = {
  inputSchema: {
    required: ['number'],
    properties: {
      number: { type: 'number' }
    }
  },
  preprocessor: (rawInput) => {
    // Normalize the input by taking its absolute value and preserving the logging flag.
    return { 
      number: Math.abs(rawInput.number),
      loggingEnabled: rawInput.loggingEnabled || false 
    };
  },
  stages: [
    {
      // Stage 1: Increment and then double the value.
      // - Tasks can be specified simply, or as an object if fallback is needed.
      //   Here, Tasks.INCREMENT is a simple task.
      //   The second task uses a fallback: if Tasks.DOUBLE fails, Tasks.FALLBACK_FOR_DOUBLE is used.
      tasks: [
        Tasks.INCREMENT,
        { fn: Tasks.DOUBLE, fallbackFn: Tasks.FALLBACK_FOR_DOUBLE }
      ],
      callback: aggregateCallback
      // Mode is omitted, so the default "parallel" is used.
    },
    {
      // Stage 2: Decrement the value repeatedly using conditional mode.
      mode: "conditional",
      tasks: [
        Tasks.DECREMENT
      ],
      // nextTasks is defined to keep decrementing until context.previous.number is <= 10.
      nextTasks: (context) => {
        // Ensure that context.previous contains an object with the number field.
        // If the current value is greater than 10, return the DECREMENT task(s).
        if (context.previous && context.previous.number > 10) {
          return [ Tasks.DECREMENT ];
        }
        // Otherwise, stop iterating by returning an empty array.
        return [];
      },
      callback: passthroughCallback
    }
  ]
};

const job_description = `This job, named 'sample_job', is designed to help users adjust numerical values in a structured, multi-step process.
It processes input numbers by first increasing them, then doubling them in Stage 1,
and then repeatedly decrementing them in Stage 2 until the value is less than or equal to 10.
If the doubling step fails, a fallback mechanism preserves the original value.
The results of Stage 1 are aggregated and passed as input to Stage 2, 
which uses conditional mode: the decrement task is executed repeatedly until a condition is met.
Detailed logging of I/O is enabled if the initial input includes the "loggingEnabled" flag.
Keywords include: adjust numbers, increase, double, decrement, structured workflow, conditional mode, error handling, fallback, numerical processing, multi-step transformation.`;

module.exports = {
  job_definition,
  job_name,
  job_description
};
