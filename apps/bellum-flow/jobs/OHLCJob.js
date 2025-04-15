const Tasks = require("../enums/taskEnums");

const passthroughCallback = (context) => {
  return context.previous[0];
};

// The job name for identification.
const job_name = "OHLC";

const job_definition = {
  inputSchema: {
    required: ['startTime', 'endTime'],
    properties: {
        startTime: { type: 'string' },
        endTime: {type: 'string'}
    }
  },

  preprocessor: (rawInput) => {
    // Normalize the input by taking its absolute value and preserving the logging flag.
    rawInput.loggingEnabled = true;
    return rawInput;
  },

  stages: [
    {
      tasks: [
        Tasks.OHLC
      ],
      callback: passthroughCallback
    }
  ]
};

const job_description = `OHLC JOB`;

module.exports = {
  job_definition,
  job_name,
  job_description
};
