const fs = require('fs');
const path = require('path');
const amqp = require('amqplib');
const appContext = require('../../core/app-context/appContext.js');
const _ = require('lodash');
const Job = require('./core/Job');
const { buildTasksRegistry, buildResolvedJob } = require('./core/JobBuilder');

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

async function process_message(message_content) {
  try {
    const job_name = _.get(message_content, "job_name");
    const job_data = _.get(message_content, "job_data");

    if (job_definitions[job_name]) {
      const job = new Job(job_name, job_definitions[job_name]);
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

async function consume() {
  try {
    await appContext.init();
    const config = appContext.getConfig();

    await build_job_definitions();
    console.log('Job Definitions:', job_definitions);

    const connection = await amqp.connect(config.rabbitMQ.rabbitMQUri);
    const channel = await connection.createChannel();

    const queue = config.rabbitMQ.queues.bellum_jobs_queue;
    await channel.assertQueue(queue, { durable: true });
    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const message_content = JSON.parse(msg.content.toString());
        await process_message(message_content);
        channel.ack(msg);
      }
    }, { noAck: false });

  } catch (err) {
    console.error('Error in consumer:', err);
  }
}

consume();
