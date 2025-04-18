const mongoose = require('mongoose');
const appContext = require('../../../core/app-context/appContext');

let connection;
function getConnection() {
  if (!connection) {
    const cfg = appContext.getConfig();
    connection = mongoose.createConnection(cfg.Cerebellum.BellumFlow.mongoUri);
  }
  return connection;
}

const jobLogSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  input: mongoose.Schema.Types.Mixed,
  stages: [{
    name: String,
    loggedInput: mongoose.Schema.Types.Mixed,
    loggedOutput: mongoose.Schema.Types.Mixed,
    startedAt: Date,
    completedAt: Date,
    is_completed: Boolean,
    error: mongoose.Schema.Types.Mixed
  }],
  finalOutput: mongoose.Schema.Types.Mixed,
  error: mongoose.Schema.Types.Mixed,
  is_completed: Boolean,
  updatedAt: { type: Date, default: Date.now }
});

const JobLog = getConnection().model(
  'JobLog',
  jobLogSchema,
  appContext.getConfig().Cerebellum.BellumFlow.collection
);

module.exports = { JobLog };