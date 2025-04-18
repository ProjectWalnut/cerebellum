const fs = require('fs');
const path = require('path');
const amqp = require('amqplib');
const appContext = require('../../core/app-context/appContext.js');
const _ = require('lodash');
// Global objects to store job definitions and task registry
let job_definitions = {};

async function build_job_definitions() {
  const jobsDir = path.join(__dirname, './jobs');
  const jobFiles = fs.readdirSync(jobsDir);
  
  for (let file of jobFiles) {
    const filePath = path.join(jobsDir, file);
    if (file.endsWith('.js')) {
      const job = require(filePath);
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
    const Job = require('./core/Job');
    const job_name = _.get(message_content, "job_name");
    const job_data = _.get(message_content, "job_data");
    const job_id = _.get(message_content, "job_id");

    if (job_definitions[job_name]) {
      // use our async factory to get a Job instance bound to the existing log
      const job = await Job.build(job_name, job_definitions[job_name], job_id);
      console.log(`Now running job - ${job_name}`)
      const result = await job.run(job_data);
      console.log('Final job output:', result);
    } else {
      console.log(`Job ${job_name} not found in job definitions.`);
    }
  } catch (error) {
    console.error(`
==================================== Job execution failed: ====================================
`, error);
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
