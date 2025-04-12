const configManager = require('../config-manager/configManager');
const Qdrant = require('../../../nuts/packages/interfaces/qdrant/qdrant');
const HuggingFace = require('../../../nuts/packages/interfaces/huggingface/huggingface');
const RabbitMQ = require('../../../nuts/packages/interfaces/rabbitmq/rabbitmq');

let appContext;

async function init() {
  if (appContext) return appContext;

  const config = await configManager.init();

  const qdrant = new Qdrant(config.qdrant);
  const huggingface = new HuggingFace(config.huggingface);
  const rabbitmq = new RabbitMQ(config.rabbitMQ);
  await rabbitmq.connect();

  appContext = {
    config,
    services: {
      qdrant,
      huggingface,
      rabbitmq,
    },
  };

  return appContext;
}

function getService(serviceName) {
  if (!appContext) throw new Error('App context not initialized. Call init() first.');
  return appContext.services[serviceName];
}

function getConfig() {
  if (!appContext) throw new Error('App context not initialized. Call init() first.');
  return appContext.config;
}

module.exports = {
  init,
  getService,
  getConfig,
};