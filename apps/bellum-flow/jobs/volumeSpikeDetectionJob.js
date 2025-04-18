const Tasks = require("../enums/taskEnums");

// Callback to aggregate results from each dynamic task.
const aggregateCallback = async (context) => {
  // Aggregate the anomalies per stock into one result object.
  const aggregated = {};
  for (let i = 0; i < context.previous.length; i++) {
    const result = context.previous[i];
    if (result && result.stock) {
      aggregated[result.stock] = result.anomalies;
    }
  }
  return aggregated;
};

const job_name = "sudden_volume_spike_detection";

// This job processes S&P intraday data for a given time range. It expects the following input fields:
// - startTime: string (e.g., "2017-09-11 09:30:00")
// - endTime: string (e.g., "2018-02-16 16:00:00")
// - stocks: array of stock symbols (e.g., ["AAPL", "GOOG", "MSFT"])
// - loggingEnabled: boolean (optional)
const job_definition = {
  inputSchema: {
    required: ['startTime', 'endTime', 'stocks', 'windowSize', 'thresholdFactor', 'chunkSizeHours'],
    properties: {
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      stocks: { type: 'array' },
      windowSize:  { type: 'number' },
      thresholdFactor:  { type: 'number' },
      chunkSizeHours: { type: 'number' },
    }
  },
  preprocessor: (rawInput) => {
    // Pass along the input as provided.
    return rawInput;
    // return { 
    //   startTime: rawInput.startTime,
    //   endTime: rawInput.endTime,
    //   stocks: rawInput.stocks,
    //   loggingEnabled: rawInput.loggingEnabled || false
    // };
  },
  stages: [
    {
      // In conditional mode, we generate a dynamic task for each stock in the provided array.
      mode: "conditional",
      tasks: [], // no static tasks; they will be created dynamically.
      nextTasks: (context) => {
        if (!context.dynamicDone && context.initial.stocks && context.initial.stocks.length > 0) {
          context.dynamicDone = true;
          // Create one parameterized task per stock.
          return context.initial.stocks.map(stock => {
            return { 
              fn: "VOLUME_SPIKE_DETECTOR", 
              args: { 
                stock, 
                windowSize: context.initial.windowSize,         // 20-minute window for stats calculation
                thresholdFactor: context.initial.thresholdFactor,      // Spike if volume > mean + 2*std
                chunkSizeHours: context.initial.chunkSizeHours       // Process data in 6-hour chunks
              } 
            };
          });
        }
        return [];
      },
      callback: aggregateCallback
    }
  ]
};

const job_description = `This job detects sudden volume spikes in S&P intraday data using a sliding window approach.
It dynamically creates a detection task for each stock specified in the input. Each task queries a PostgreSQL
database in 6-hour chunks, processes the data with an optimized sliding window (20 minutes) and flags volume spikes
using the criterion: volume > mean + 3 * standard deviation.
The aggregated anomaly results are returned keyed by stock symbol.`;

module.exports = {
  job_definition,
  job_name,
  job_description
};


/* sample input:
{
  "job_name": "sudden_volume_spike_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2018-02-16 16:00:00",
    "stocks": [
      "AAPL"
    ],
    "windowSize": 20,
    "thresholdFactor": 2,
    "chunkSizeHours": 6
  }
}
// highest‐quality spikes (that are statistically extreme) 292 spikes
{
  "job_name": "sudden_volume_spike_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2018-02-16 16:00:00",
    "stocks": [
      "AAPL"
    ],
    "windowSize": 72,
    "thresholdFactor": 6,
    "chunkSizeHours": 12
  }
}

Logic:

Query 12‑hour chunks of intraday volume.

Maintain a 72‑row sliding window with running sum & sum‑of‑squares.

Compute mean & std, flag a spike when volume > mean + 6×std, record only the first event per spike.

{
  "job_name": "sudden_volume_spike_detection",
  "job_data": {
    "startTime": "2017-09-11 09:30:00",
    "endTime": "2018-02-16 16:00:00",
    "stocks": [ "A","AAL","AAP","AAPL","AMD","AME","AMG","AMP","AMZN","AON","AOS","APA","APC","APD","APH","ARE"
],
    "windowSize": 72,
    "thresholdFactor": 6,
    "chunkSizeHours": 12
  }
}
  */