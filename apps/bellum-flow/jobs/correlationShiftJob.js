const Tasks = require("../enums/taskEnums");

const passthroughCallback = (context) => {
  return context.previous[0];
};

const job_name = "sudden_correlation_shift_detection";

const job_definition = {
  inputSchema: {
    required: ['startTime', 'endTime', 'stockA', 'stockB', 'windowSize', 'shiftThreshold', 'chunkSizeHours'],
    properties: {
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      stockA: { type: 'string' },
      stockB: { type: 'string' },
      windowSize: { type: 'number'},
      shiftThreshold: { type: 'number'},
      chunkSizeHours: { type: 'number'}
    }
  },
  preprocessor: (rawInput) => {
    return {
      startTime: rawInput.startTime,
      endTime: rawInput.endTime,
      stockA: rawInput.stockA,
      stockB: rawInput.stockB,
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
        if (!context.dynamicDone) {
            context.dynamicDone = true;
            return [{
                fn: "SUDDEN_CORRELATION_SHIFT", args: { windowSize: context.initial.windowSize, shiftThreshold: context.initial.shiftThreshold, chunkSizeHours: context.initial.chunkSizeHours } 
            }]
        }
        return []
      },

      callback: passthroughCallback
    }
  ]
};

const job_description = `This job detects sudden shifts in correlation between two stocks (e.g., AAPL and NVDA) over a specified time range.
It retrieves one-minute closing price data for both stocks from PostgreSQL in contiguous 6-hour chunks.
Using a sliding window (default 5 minutes), the algorithm updates rolling aggregates incrementally to compute Pearson correlation.
If the absolute difference between consecutive window correlations exceeds the specified shiftThreshold (default 0.5), an anomaly is flagged.
Results are returned keyed by the stock pair.`;

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
    "stockA": "AAPL",
    "stockB": "NVDA",
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
    "stockA": "AAPL",
    "stockB": "NVDA",
    "windowSize": 30,
    "shiftThreshold": 0.7,
    "chunkSizeHours": 12
  }
}
*/