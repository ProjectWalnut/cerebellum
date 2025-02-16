const fs = require('fs');
const path = require('path');
const amqp = require('amqplib');
const appContext = require('../../core/app-context/appContext.js');
const mongoose = require('mongoose');
const _ = require('lodash')

const Job = require('./core/Job');

// global.logger = require('../utils/logger');

let job_definitions = {};

async function build_job_definitions() {

    // Read files from the ../Jobs directory
    const job_files = fs.readdirSync(path.join(__dirname, '../bellum-flow/jobs'));

    for (let file of job_files) {
        const file_path = path.join(__dirname, '../bellum-flow/jobs', file);
        
        // Only process JavaScript files
        if (file.endsWith('.js')) {
            const job = require(file_path);
            
            // Assuming the job file exports an object with 'name' and 'array'
            if (job && job.job_name && Array.isArray(job.job_definition)) {
                job_definitions[job.job_name] = job.job_definition;
            } else {
                global.logger.warn(`Invalid job definition in file: ${file}`);
            }
        }
    }

    return job_definitions;
}

async function process_message(message_content) {

    try{
        const job_name = _.get(message_content, "job_name");
        const job_data = _.get(message_content, "job_data");
    
        // Check if job exists in the map
        if (job_definitions[job_name]) {
            const job_definition = job_definitions[job_name];
    
            // Process the job
            console.log(`Processing job: ${job_name} with data:`, job_data);
            const job = new Job(job_name, job_definition);
            result = await job.run(job_data);
            console.log('Final job output:', result);
        }
    }
    catch (error) {
        console.log('Job execution failed:', error);
    }
}

async function consume() {
    try {
        // Initialize appContext and get configurations

        await appContext.init();
        const config = appContext.getConfig();

        // Build job definitions map
        const job_definitions = await build_job_definitions();
        console.log('Job Definitions:', job_definitions);
        
        // Connect to RabbitMQ
        const connection = await amqp.connect(config.rabbitMQ.rabbitMQUri);
        const channel = await connection.createChannel();

        // Declare a queue
        const queue = config.rabbitMQ.queues.bellum_jobs_queue; // Change this to your actual queue name
        await channel.assertQueue(queue, { durable: true });

        console.log('Waiting for messages in %s. To exit press CTRL+C', queue);

        // Consume messages from the queue
        channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const message_content = JSON.parse(msg.content.toString());
                    await process_message(message_content);

                    // Acknowledge the message after processing
                    channel.ack(msg);
                } else {
                    console.log(`Job ${job_name} not found in job definitions.`);
                    channel.nack(msg, false, true); // Reject and requeue the message
                }
            }, { noAck: false });

    } catch (err) {
        console.error('Error in consumer:', err);
    }
}

// Start the consumer
consume();
