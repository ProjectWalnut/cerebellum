const mongoose = require('mongoose');
const _ = require('lodash');

const defaultConfig = {
  Cerebellum: {
    BellumFlow: {
      logging: {
        level: 'info',
        mongoUri: 'mongodb://admin:adminpassword@mongo_db:27017/generatedDB?authSource=admin',
        collectionName: 'BellumFlowJobs'
      },
      retryOptions: {
        retries: 3,
        delay: 1000
      }
    }
  }
};

let configSingleton = null;
let initPromise = null;

const configSchema = new mongoose.Schema({
  // Schema definition maintains structure but allows additional fields
  Cerebellum: {
    BellumFlow: {
      logging: {
        level: String,
        mongoUri: String,
        collectionName: String
      },
      retryOptions: {
        retries: Number,
        delay: Number
      }
    }
  }
}, { 
  collection: 'configurations',
  strict: false // Allows storing additional configuration fields
});

const ConfigModel = mongoose.model('Configuration', configSchema);

async function init(connectionString) {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const env = process.env.NODE_ENV || 'development';
      connectionString = process.env.MONGO_CONFIG_URI || connectionString || getDefaultConnectionString(env);

      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(connectionString, {
          serverSelectionTimeoutMS: 5000
        });
      }

      let configDoc = await ConfigModel.findOne({});
      if (!configDoc) {
        configDoc = new ConfigModel(defaultConfig);
        await configDoc.save();
      }

      configSingleton = configDoc.toObject({ virtuals: true });
    //   applyEnvironmentOverrides(configSingleton);

      return configSingleton;
    } catch (error) {
      console.error('Configuration initialization failed:', error.message);
      throw new Error(`Config initialization failed: ${error.message}`);
    }
  })();

  return initPromise;
}

function getDefaultConnectionString(env) {
  switch (env) {
    case 'production':
      return 'mongodb://prod_user:prod_pass@prod_mongo:27017/configurationsDB?authSource=admin';
    case 'test':
      return 'mongodb://localhost:27017/test_configurationsDB';
    default:
      return 'mongodb://admin:adminpassword@mongo_db:27017/configurationsDB?authSource=admin';
  }
}

function applyEnvironmentOverrides(config) {
  const traverse = (obj, parentKeys = []) => {
    for (const key in obj) {
      const pathKeys = [...parentKeys, key];
      
      if (_.isPlainObject(obj[key])) {
        traverse(obj[key], pathKeys);
      } else {
        const envVar = pathKeys.join('_').toUpperCase();
        if (process.env[envVar]) {
          obj[key] = convertValue(obj[key], process.env[envVar]);
          console.log(`Overridden ${pathKeys.join('.')} from environment variable ${envVar}`);
        }
      }
    }
  };

  traverse(config);
}

function convertValue(originalValue, envValue) {
  switch (typeof originalValue) {
    case 'number':
      return Number(envValue) || originalValue;
    case 'boolean':
      return envValue.toLowerCase() === 'true';
    default:
      return envValue;
  }
}

function getConfig() {
  if (!configSingleton) throw new Error("Configuration not initialized. Call init() first.");
  return _.cloneDeep(configSingleton);
}

module.exports = {
  init,
  getConfig,
  defaultConfig
};