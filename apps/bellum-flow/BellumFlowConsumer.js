const fs = require('fs');
const path = require('path');
const amqp = require('amqplib');
const appContext = require('../../core/app-context/appContext.js');
const _ = require('lodash');
const Job = require('./core/Job');

// Global objects to store job definitions and task registry
let job_definitions = {};
let tasksRegistry = {};

/**
 * Build the tasks registry at runtime.
 *
 * This function reads all JavaScript files in the tasks directory,
 * and builds a mapping from each task's exported `task_name` to the task function.
 * 
 * New developers: Each task file MUST export a property called `task_name`.
 * For example, in your task file:
 *
 *    module.exports.task_name = "INCREMENT";
 *    module.exports = function(input) { ... };
 *
 * If a task file doesn't export `task_name`, an error is thrown.
 */
async function build_tasks_registry() {
  const tasksDir = path.join(__dirname, './tasks');
  const task_files = fs.readdirSync(tasksDir);
  
  for (let file of task_files) {
    if (file.endsWith('.js')) {
      const taskModule = require(path.join(tasksDir, file));
  
        // Check if the task module exports a task_name property
      if (!taskModule.task_name) {
        throw new Error(`Task file "${file}" does not export a "task_name" property.`);
      }
  
        // Use the exported task_name as the key in the registry
        const taskName = taskModule.task_name.toUpperCase(); // Normalize to uppercase if needed
      tasksRegistry[taskName] = taskModule;
    }
  }
}

/**
 * Dynamically load all job definitions from the jobs directory.
 * 
 * Each job file should export an object with:
 * - `job_name`
 * - `job_definition` (an array defining the stages)
 */
async function build_job_definitions() {
  const jobsDir = path.join(__dirname, './jobs');
  const job_files = fs.readdirSync(jobsDir);
  
  for (let file of job_files) {
    const file_path = path.join(jobsDir, file);

    if (file.endsWith('.js')) {
      const job = require(file_path);
      if (job && job.job_name && job.job_definition) {
        job_definitions[job.job_name] = job.job_definition;
      } else {
        console.warn(`Invalid job definition in file: ${file}`);
      }
    }
  }
}

/**
 * Process a job message from the queue.
 * 
 * The consumer:
 *  - Resolves each task using tasksRegistry.
 *  - Auto-generates stage names (Stage 1, Stage 2, etc.) based on array index.
 *  - Uses the provided callback function (direct reference) for each stage.
 */
async function process_message(message_content) {
  try {
    const job_name = _.get(message_content, "job_name");
    const job_data = _.get(message_content, "job_data");

    if (job_definitions[job_name]) {
      const job_definition = job_definitions[job_name];

      // Resolve each stage's tasks and callback.
      const resolved_job = {
        inputSchema: job_definition.inputSchema,
        preprocessor: job_definition.preprocessor,
        stages: job_definition.stages.map((stage, index) => ({
          name: `Stage ${index + 1}`,
          tasks: stage.tasks.map(task =>
            typeof task === "string"
              ? { fn: tasksRegistry[task.toUpperCase()] }
              : {
                  fn: tasksRegistry[task.fn.toUpperCase()],
                  fallbackFn: task.fallbackFn ? tasksRegistry[task.fallbackFn.toUpperCase()] : undefined
                }
          ),
          callback: stage.callback
        }))
      };

      console.log(`Processing job: ${job_name} with data:`, job_data);
      const job = new Job(job_name, resolved_job);
      const result = await job.run(job_data);
      console.log('Final job output:', result);
    } else {
      console.log(`Job ${job_name} not found in job definitions.`);
    }
  } catch (error) {
    console.log(`
      
      ==================================== Job execution failed: (see below error) ====================================

      `
      ,error);
  }
}

/**
 * Start the consumer.
 * 
 * The consumer:
 *  1. Initializes the app context.
 *  2. Builds the tasks registry (dynamically loads all tasks).
 *  3. Loads all job definitions.
 *  4. Connects to RabbitMQ and starts processing messages.
 */
async function consume() {
  try {
    // Initialize application context and configuration
    await appContext.init();
    const config = appContext.getConfig();

    // Build tasks registry dynamically
    await build_tasks_registry();
    console.log('Task Registry Built:', tasksRegistry);

    // Build job definitions from job files
    await build_job_definitions();
    console.log('Job Definitions:', job_definitions);

    // Connect to RabbitMQ and create a channel
    const connection = await amqp.connect(config.rabbitMQ.rabbitMQUri);
    const channel = await connection.createChannel();

    // Declare the queue from which to consume job messages
    const queue = config.rabbitMQ.queues.bellum_jobs_queue;
    await channel.assertQueue(queue, { durable: true });
    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);

    // Consume messages from the queue
    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const message_content = JSON.parse(msg.content.toString());
        await process_message(message_content);
        // Acknowledge the message after successful processing
        channel.ack(msg);
      }
    }, { noAck: false });

  } catch (err) {
    console.error('Error in consumer:', err);
  }
}

// Start the consumer process
consume();
