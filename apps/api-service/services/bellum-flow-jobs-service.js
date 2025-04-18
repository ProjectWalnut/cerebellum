const appContext = require("../../../core/app-context/appContext");
const { JobLog } = require('../../bellum-flow/core/jobLogModel');

async function enqueue_job(job_name, job_data) {
  // 1) Create the JobLog record and grab its _id
  const newLog = await JobLog.create({
    name: job_name,
    input: job_data,
    is_completed: false
  });
  const job_id = newLog._id.toString();

  // 2) Enqueue message with job_id
  const config = appContext.getConfig();
  const rabbitmq = appContext.getService("rabbitmq");

    // Get the RMQ queue name for jobs from the configuration
  const queueName = config.rabbitMQ.queues.bellum_jobs_queue;
  const message = { job_name, job_data, job_id };

    // Enqueue the job using the generic enqueue method of the RabbitMQ service
  await rabbitmq.enqueue(queueName, message);

  // 3) Return the new job_id to the client
  return { success: true, message: "Job enqueued", job_id, job_data };
}

module.exports = {
    enqueue_job: enqueue_job
}