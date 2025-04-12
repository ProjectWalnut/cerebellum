const Router = require("@koa/router");
const router = new Router();
const bellum_flow_jobs_service = require("../services/bellum-flow-jobs-service")

// All jobs Routes
router.post("/jobs", enqueue_job);

async function enqueue_job(ctx) {
  const { job_name, job_data } = ctx.request.body;

  if (!job_name || !job_data) {
    ctx.status = 400;
    ctx.body = { error: "Missing required fields: job_name and job_data" };
    return;
  }

  try {
    let result = await bellum_flow_jobs_service.enqueue_job(job_name, job_data);
    ctx.status = 200;
    ctx.body = result;

  } catch (err) {
    console.error("Failed to enqueue job:", err);
    ctx.status = 500;
    ctx.body = { error: "Failed to enqueue job" };
  }
}



module.exports = router;
