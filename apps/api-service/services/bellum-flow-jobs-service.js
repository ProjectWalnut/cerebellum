const appContext = require("../../../core/app-context/appContext");

async function enqueue_job(job_name, job_data) {

    // Retrieve configuration and RabbitMQ service from appContext
    const config = appContext.getConfig();
    const rabbitmq = appContext.getService("rabbitmq");

    // Get the RMQ queue name for jobs from the configuration
    const queueName = config.rabbitMQ.queues.bellum_jobs_queue;
    const message = { job_name, job_data };

    // Enqueue the job using the generic enqueue method of the RabbitMQ service
    await rabbitmq.enqueue(queueName, message);

    let result = { success: true, message: "Job enqueued" };
    return result;
}

module.exports = {
    enqueue_job: enqueue_job
}