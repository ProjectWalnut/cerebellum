# 🔥 BellumFlow: A Generic, Extensible Job‑Orchestration Framework

## Table of Contents
1. [Overview](#overview)  
2. [Core Concepts & Architecture](#core-concepts--architecture)  
3. [Generic Technical Use Cases](#generic-technical-use-cases)  
4. [Memory Efficiency & OOM Avoidance](#memory-efficiency--oom-avoidance)  
5. [Setup & Deployment](#setup--deployment)  
6. [Defining Tasks & Jobs](#defining-tasks--jobs)  
7. [Running the Consumer](#running-the-consumer)  
8. [Examples](#examples)  
9. [Contributing](#contributing)  
10. [License](#license)  

---

## Overview
BellumFlow is a **standalone**, open‑source framework for orchestrating complex, multi‑step data or compute pipelines.  
Designed to be **domain‑agnostic**, you can write “Jobs” for any use case, from ETL and ML workflows to DevOps automation.

**Key Pillars:**
- **Modularity:** Define Tasks (units of work) and Jobs (pipelines of stages/tasks) in simple JavaScript.  
- **Extensibility:** Drop in new Tasks or stages without touching core code.  
- **Dynamic Execution:** Support for conditional workflows, dynamic task generation, and parallel/serial execution modes.  
- **Observability & Robustness:** Built‑in logging, retry/fallback mechanisms, and per‑stage error handling.  
- **Tech‑Stack Agnostic:** Works standalone or coupled with RabbitMQ/Kafka for queuing, MongoDB/SQL for logging, Docker/K8s for deployment.  

---

## Core Concepts & Architecture

### Task
- **Signature:** \`async (input[, args]) → output\`  
- Optional **inputSchema** / **outputSchema** for validation.  
- Optional **args** parameterization (e.g., \`{ symbol: "AAPL" }\`).  
- Built‑in retry + fallback.

### Stage
- A collection of Tasks executed in one of two modes:  
  - **Parallel:** \`Promise.all(tasks)\` → aggregate or map results.  
  - **Conditional:** Iteratively invoke \`nextTasks(context)\` until no more tasks.  
- Each stage can declare a **callback** to reduce or reshape results.

### Job
- An ordered list of **Stages**.  
- Optional **preprocessor** to validate/normalize raw job input.  
- Tracks a shared **context** object through each stage.  
- Persists logs to a database (MongoDB by default) for auditing and debugging.

### JobBuilder
- Converts declarative job definitions into executable Stage and Task instances.  
- Dynamically loads all Task modules from a \`/tasks\` directory.

### Consumer (optional)
- Listens for incoming job messages (e.g., via RabbitMQ).  
- Instantiates and runs Jobs, acknowledging messages on success.

---

## Generic Technical Use Cases
BellumFlow shines wherever you need fault‑tolerant, stateful pipelines:
- **ETL Pipelines:** Chunk, transform, validate, and load huge data sets without OOM.  
- **ML Preprocessing/Inference:** Parallel feature extraction, chained model inference, result logging.  
- **Web Scraping & Enrichment:** Parallel fetch, parse, normalize, conditional crawling.  
- **DevOps Workflows:** Dynamic branching of infra tasks (provision → deploy → test).  
- **Automated Reporting:** Scheduled pulls, transformations, PDF/Excel generation, and delivery.

---

## Memory Efficiency & OOM Avoidance
- **Chunk‑based Processing:** Pull data in manageable slices (e.g., 6‑hour chunks).  
- **Persistent Sliding Windows:** Fixed‑size buffers in Tasks (volume‑spike, correlation‑shift) keep memory constant.  
- **Garbage Collection Friendly:** Data from each chunk goes out of scope after processing.  
- **Parallel Workers:** Scale horizontally with multiple Node.js processes rather than blowing up a single process.

---

## Setup & Deployment

### Prerequisites
- [Node.js](https://nodejs.org/) v18+  
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)  

### Clone & Start Services
\`\`\`bash
git clone https://github.com/your-org/bellumflow.git
cd bellumflow
docker-compose up -d
\`\`\`

This will spin up:
- RabbitMQ (for optional queuing)  
- MongoDB (for logging)  
- PostgreSQL (example data store)  

---

## Defining Tasks & Jobs

1. **Create a Task** in \`/tasks\`:  
   \`\`\`js
   // tasks/myTask.js
   module.exports.task_name = "MY_TASK";
   module.exports = async (input, args) => {
     // ...do work...
     return result;
   };
   \`\`\`

2. **Define a Job** in \`/jobs\`:  
   \`\`\`js
   // jobs/myJob.js
   const passthrough = ctx => ctx.previous;
   module.exports = {
     job_name: "my_job",
     job_definition: {
       inputSchema: { /* ... */ },
       preprocessor: raw => raw,
       stages: [
         {
           mode: "parallel",
           tasks: ["MY_TASK"],
           callback: passthrough
         }
       ]
     }
   };
   \`\`\`

---

## Running the Consumer

Install dependencies and start the worker:

\`\`\`bash
npm install
npm run consumer   # or: node src/consumer.js
\`\`\`

Submit jobs by pushing JSON messages to the queue or call \`job.run(jobData)\` directly in code.

---

## Examples

### Sudden Volume Spike Detection
- **Input:** \`{ startTime, endTime, stocks: ["AAPL"], windowSize:72, thresholdFactor:6, chunkSizeHours:12 }\`  
- **Task:** \`VOLUME_SPIKE_DETECTOR\` (in \`tasks/VolumeSpikeDetector.js\`)  
- **Detects:** Extreme volume surges without overcounting.

### Sudden Correlation Shift Detection
- **Input:** \`{ startTime, endTime, stockPairs:[{stockA,stockB},…], windowSize:30, shiftThreshold:0.7, chunkSizeHours:12 }\`  
- **Task:** \`SUDDEN_CORRELATION_SHIFT\` (in \`tasks/SuddenCorrelationShiftDetector.js\`)  
- **Detects:** Large jumps (>0.7) in rolling Pearson correlation between stock pairs.

