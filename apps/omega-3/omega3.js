const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const amqp = require('amqplib');
const appContext = require('../../core/app-context/appContext');

let qdrant;
let huggingface;
let channel;
let bellumJobsQueue;

// --- Main Processing Functions ---
async function indexDescriptions() {
    const jobsDir = path.join(__dirname, '../bellum-flow/jobs');
    const tasksDir = path.join(__dirname, '../bellum-flow/tasks');

    // Index jobs
    const jobFiles = fs.readdirSync(jobsDir).filter(file => file.endsWith('.js'));
    for (const file of jobFiles) {
        const jobPath = path.join(jobsDir, file);
        const jobModule = require(jobPath);
        const jobName = jobModule.job_name || jobModule.name || path.basename(file, '.js');
        const jobDescription = jobModule.job_description;

        if (jobDescription) {
            try {
                const embedding = await huggingface.getEmbedding(jobDescription);
                const point = {
                    id: 1,
                    vector: embedding,
                    payload: {
                        type: 'job',
                        name: jobName,
                        description: jobDescription
                    }
                };
                await qdrant.upsertPoint(point);
                console.log(`Indexed job: ${jobName}`);
            } catch (error) {
                console.error(`Failed to index job ${jobName}: ${error.message}`);
            }
        }
    }

    // Index tasks
    const taskFiles = fs.readdirSync(tasksDir).filter(file => file.endsWith('.js'));
    for (const file of taskFiles) {
        const taskPath = path.join(tasksDir, file);
        const taskModule = require(taskPath);
        const taskName = taskModule.task_name || taskModule.name || path.basename(file, '.js');
        const taskDescription = taskModule.task_description;

        if (taskDescription) {
            try {
                const embedding = await huggingface.getEmbedding(taskDescription);
                const point = {
                    id: `task:${taskName}`,
                    vector: embedding,
                    payload: {
                        type: 'task',
                        name: taskName,
                        description: taskDescription
                    }
                };
                await qdrant.upsertPoint(point);
                console.log(`Indexed task: ${taskName}`);
            } catch (error) {
                console.error(`Failed to index task ${taskName}: ${error.message}`);
            }
        }
    }
}

async function searchForJob(prompt, jobData) {
    try {
        const queryEmbedding = await huggingface.getEmbedding(prompt);
        const results = await qdrant.searchPoints(queryEmbedding, 5, {
            must: [
                { key: 'type', match: { value: 'job' } }
            ]
        });

        console.log('Search results:');
        results.forEach(result => {
            console.log(`Job: ${result.payload.name}, Score: ${result.score}`);
        });

        if (results.length > 0 && results[0].score > 0.5) {
            const jobName = results[0].payload.name;
            console.log(`Enqueuing job: ${jobName} with confidence ${results[0].score}`);
            
            const messageContent = {
                job_name: jobName,
                job_data: jobData
            };

            await channel.sendToQueue(
                bellumJobsQueue,
                Buffer.from(JSON.stringify(messageContent)),
                { persistent: true }
            );
            console.log(`Successfully enqueued job: ${jobName}`);
        } else {
            console.log('No job with sufficient confidence found.');
        }
    } catch (error) {
        console.error('Error in searchForJob:', error.message);
    }
}

// --- Main Execution ---
async function main() {
    try {
        // Initialize appContext
        await appContext.init();

        // Fetch config and services
        const config = appContext.getConfig();
        qdrant = appContext.getService('qdrant');
        huggingface = appContext.getService('huggingface');

        // Initialize RabbitMQ connection
        const connection = await amqp.connect(config.rabbitMQ.rabbitMQUri);
        channel = await connection.createChannel();
        bellumJobsQueue = config.rabbitMQ.queues.bellum_jobs_queue;
        await channel.assertQueue(bellumJobsQueue, { durable: true });

        console.log("Indexing job and task descriptions...");
        await indexDescriptions();
        console.log("Indexing complete.");

        const prompt1 = "I need a job to process and aggregate large datasets.";
        const prompt2 = "I need to process some numbers in a specific way. First, I want to increase them by a fixed amount, then double them, and finally decrease them by another amount. If the doubling step fails, I want to skip it and keep the original number. Can you help me set this up in a structured way";
        const job_inputs = {
            "job_name": "sample_job",
            "job_data": 10
        };

        console.log(`Searching for jobs matching: "${prompt1}"`);
        await searchForJob(prompt1, job_inputs.job_data);
        console.log(`Searching for jobs matching: "${prompt2}"`);
        await searchForJob(prompt2, job_inputs.job_data);

        // Close RabbitMQ connection
        await channel.close();
        await connection.close();
    } catch (error) {
        console.error("Main process error:", error.message);
    }
}

main();