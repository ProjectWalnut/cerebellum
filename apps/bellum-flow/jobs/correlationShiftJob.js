const Tasks = require("../enums/taskEnums");

const passthroughCallback = (context) => {
  return context.previous;
};

const job_name = "sudden_correlation_shift_detection";

// Updated job definition:
// - Input now requires a "stockPairs" array (each with stockA and stockB)
// - The nextTasks function dynamically creates one task for every pair provided.
const job_definition = {
  inputSchema: {
    required: ['startTime', 'endTime', 'stockPairs', 'windowSize', 'shiftThreshold', 'chunkSizeHours'],
    properties: {
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      // stockPairs is an array of objects with stockA and stockB as required strings.
      stockPairs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['stockA', 'stockB'],
          properties: {
            stockA: { type: 'string' },
            stockB: { type: 'string' }
          }
        }
      },
      windowSize: { type: 'number' },
      shiftThreshold: { type: 'number' },
      chunkSizeHours: { type: 'number' },
      loggingEnabled: { type: 'boolean' }
    }
  },
  preprocessor: (rawInput) => {
    return {
      startTime: rawInput.startTime,
      endTime: rawInput.endTime,
      stockPairs: rawInput.stockPairs, // expect array of objects, e.g., [{stockA: "AAPL", stockB: "NVDA"}, {...}]
      windowSize: rawInput.windowSize,
      shiftThreshold: rawInput.shiftThreshold,
      chunkSizeHours: rawInput.chunkSizeHours,
      loggingEnabled: rawInput.loggingEnabled || false
    };
  },
  stages: [
    {
      mode: "conditional",
      tasks: [],
      nextTasks: (context) => {
        // Enqueue one task per stock pair if not already done.
        if (!context.dynamicDone && context.initial.stockPairs && context.initial.stockPairs.length > 0) {
          context.dynamicDone = true;
          // For every pair, create a task using the parameterized task mechanism.
          return context.initial.stockPairs.map(pair => {
            return {
              fn: "SUDDEN_CORRELATION_SHIFT", 
              args: {
                windowSize: context.initial.windowSize,
                shiftThreshold: context.initial.shiftThreshold,
                chunkSizeHours: context.initial.chunkSizeHours,
                stockA: pair.stockA,
                stockB: pair.stockB
              }
            };
          });
        }
        return [];
      },
      callback: passthroughCallback
    }
  ]
};

const job_description = `This job detects sudden shifts in correlation between multiple pairs of stocks over a specified time range.
It expects a "stockPairs" array (each object containing stockA and stockB) along with parameters: startTime, endTime, windowSize, shiftThreshold, and chunkSizeHours.
Using a sliding window (e.g., 30 minutes) and an incremental rolling aggregates method, it computes the Pearson correlation between the two stocks in each pair.
If the absolute difference between consecutive window correlations exceeds the specified shiftThreshold, an anomaly is flagged.
The job dynamically generates a separate task for every stock pair via the nextTasks function, and returns an array of results keyed by each stock pair.`;

module.exports = {
  job_definition,
  job_name,
  job_description
};
/*
{
  "job_name": "sudden_correlation_shift_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2018-02-16 16:00:00",
    "stockPairs":[{
    "stockA": "AAPL",
    "stockB": "NVDA",
    }],
    "windowSize": 5,
    "shiftThreshold": 0.5,
    "chunkSizeHours": 12
  }
}
// Good quality 18 instances
{
  "job_name": "sudden_correlation_shift_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2018-02-16 16:00:00",
    "stockPairs":[{
    "stockA": "AAPL",
    "stockB": "NVDA"
    }],
    "windowSize": 30,
    "shiftThreshold": 0.7,
    "chunkSizeHours": 12
  }
}
  minutes * days * years * stock_sym

  {
  "job_name": "sudden_correlation_shift_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2023-09-11 09:30:00",
    "stockPairs": [
      {"stockA": "AAPL", "stockB": "NVDA"},
      {"stockA": "AAPL", "stockB": "MSFT"},
      {"stockA": "AAPL", "stockB": "GOOGL"},
      {"stockA": "AAPL", "stockB": "GM"},
      {"stockA": "AAPL", "stockB": "AMZN"},
      {"stockA": "AAPL", "stockB": "WMT"},
      {"stockA": "AAPL", "stockB": "AMD"},
      {"stockA": "AAPL", "stockB": "JPM"},
      {"stockA": "NVDA", "stockB": "MSFT"},
      {"stockA": "NVDA", "stockB": "GOOGL"},
      {"stockA": "NVDA", "stockB": "GM"},
      {"stockA": "NVDA", "stockB": "AMZN"},
      {"stockA": "NVDA", "stockB": "WMT"},
      {"stockA": "NVDA", "stockB": "AMD"},
      {"stockA": "NVDA", "stockB": "JPM"}
    ],
    "windowSize": 30,
    "shiftThreshold": 0.7,
    "chunkSizeHours": 12
  }
}
*/
