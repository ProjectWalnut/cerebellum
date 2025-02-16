const configManager = require('../Configurations/configManager');
const mongoose = require('mongoose');
const Job = require('../BellumFlow/Core/Job');

/**
 * Main entry point of the application.
 */
async function init() {
  try {
    // Define the connection string for the configuration database.
    const CONFIG_DB_CONNECTION_STRING = 'mongodb://admin:adminpassword@mongo_db:27017/configurationsDB?authSource=admin';
    // Use the service name "mongo_db" instead of "localhost"
    const config = await configManager.init(CONFIG_DB_CONNECTION_STRING);
    console.log("Loaded configuration:", config);
  } catch (err) {
    console.error(err);
  }
}

async function runJob(sample_job) {
  try {
    const finalResult = await sample_job.run(5);
    // logger.info('Final job output:' + finalResult);
    console.log('Final job output:', finalResult);
  } catch (error) {
    console.log('Job execution failed:', error);
  } finally {
    // Clean up the mongoose connection.
    mongoose.connection.close();
  }
}

async function main() {

  try{
    await init();
    global.logger = require('../BellumFlow/utils/logger');
    const sample_job_definition =require('../BellumFlow/Jobs/sampleJob');
    const sample_job = new Job("SampleJob", sample_job_definition);
    await runJob(sample_job);
  } catch(err) {
    console.log(err);
  }
}

main();
