const mongoose = require('mongoose');


// STEP 1: Import Tasks that you require
const incrementTaskFn = require('../tasks/sampleTask_IncrementFn.js');
const decrementTaskFn = require('../tasks/sampleTask_DecrementFn.js')

const doubleTaskFn = require('../tasks/sampleTask_DoubleFn.js')

// STEP 2: Write Callbacks and fallbacks 

// Fallback function for the "Double" task.
const doubleFallback = async (input, error) => {
  console.log(`Fallback for doubleTaskFn triggered due to error: ${error.message}`);

  // As a simple fallback, return the input unchanged.
  return input;
};

// Callback to aggregate results in a stage (e.g., summing results)
const aggregateCallback = async (results) => {
  return results.reduce((acc, val) => acc + val, 0);
};

// STEP 3: Write Job Definition.

// A Job is an array of Stages.
// Each Stage has multiple Tasks and is associated with a single Callback
// The purpose of Callback is to transform the outputs of tasks of that stage into 
// The required inputs of the tasks for the next stage.
// Tasks need to be designed as modular units that work on the inputs and perform 
// some business logic and return some outputs.

const job_name = "sample_job";
const job_definition = [
  {
    name: 'Stage 1',
    tasks: [
      { name: 'Increment', fn: incrementTaskFn },
      { name: 'Double', fn: doubleTaskFn, fallbackFn: doubleFallback }
    ],
    callback: aggregateCallback
  },
  {
    name: 'Stage 2',
    tasks: [
      { name: 'Decrement', fn: decrementTaskFn }
    ],
    callback: (results) => results[0]
  }
];

// const job_description = "This job, named 'sample_job', is a multi-stage workflow designed to process and transform input data through a series of modular tasks. Each stage consists of one or more tasks that perform specific operations on the input data. The outputs of these tasks are aggregated or transformed using callbacks, which prepare the data for subsequent stages. The job is implemented using a Node.js environment with Mongoose for database interactions and modular task functions for business logic. In Stage 1, the 'Increment' task increases the input value by a predefined amount, and the 'Double' task multiplies the input value by 2. If the 'Double' task fails, a fallback function ('doubleFallback') is triggered to return the input unchanged. The results of the 'Increment' and 'Double' tasks are aggregated using the 'aggregateCallback', which sums the outputs of the tasks in this stage. In Stage 2, the 'Decrement' task reduces the input value by a predefined amount, and a callback returns the result of the 'Decrement' task as the final output of the job. The tasks include 'incrementTaskFn' for incrementing, 'doubleTaskFn' for doubling (with 'doubleFallback' as its fallback function), and 'decrementTaskFn' for decrementing. Callbacks include 'aggregateCallback' for summing task outputs in Stage 1 and a simple callback in Stage 2 to return the final result. This job is suitable for data transformation pipelines, workflow automation for numerical data processing, and modular task-based job definitions. Keywords for similarity search include Node.js, JavaScript, Mongoose, MongoDB, task-based workflow, modular tasks, data transformation, increment, decrement, double, fallback function, callback, aggregation, multi-stage job, error handling, and numerical processing."

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
}
