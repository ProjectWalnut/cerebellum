// src/utils/logger.js

const { createLogger, format, transports } = require('winston');
require('winston-mongodb');
const configManager = require('../../Configurations/configManager');

// Get configuration (if not yet initialized, this will return the defaults)
const config = configManager.getConfig();

const logger = createLogger({
  level: config.Cerebellum.BellumFlow.logging.level || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.MongoDB({
      level: 'info',
      db: config.Cerebellum.BellumFlow.logging.mongoUri,
      // options: { useUnifiedTopology: true },
      collection: config.Cerebellum.BellumFlow.logging.collectionName || 'log'
    })
  ],
});

module.exports = logger;
