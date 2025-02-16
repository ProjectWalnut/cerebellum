const configManager = require('../config-manager/configManager');
const Qdrant = require('../../../nuts/packages/interfaces/qdrant/qdrant');
const HuggingFace = require('../../../nuts/packages/interfaces/huggingface/huggingface');

let appContext;

async function init() {
  if (appContext) return appContext;

  const config = await configManager.init();
  const qdrant = new Qdrant(config.qdrant);
  const huggingface = new HuggingFace(config.huggingface);

  appContext = {
    config,
    services: {
      qdrant,
      huggingface,
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