const Tasks = require("../enums/taskEnums");

// Simple passthrough callback: just return the first task result.
const passthroughCallback = (results) => {
  return results[0];
};

/**
 * Job Definition: analysis_job
 *
 * This job orchestrates the entire pipeline:
 *  1. DATA_INGESTION_MERGE: Reads CSV files for intraday data, company metadata, and index data; applies a date range filter and merges data on stock symbol.
 *  2. DAILY_AGGREGATION: Aggregates the merged intraday data into daily OHLCV summaries.
 *  3. TECHNICAL_ANALYSIS: Computes technical indicators (e.g., SMA) and flags volume anomalies using a configurable SMA window.
 *  4. VISUALIZATION_PREPARATION: Prepares the processed data as a JSON payload for frontend visualizations.
 *
 * Input Schema:
 *  - start_date (string): e.g., "2017-09-11"
 *  - end_date (string): e.g., "2018-02-16"
 *  - sma_window (number): window length for the moving average calculation.
 *
 * The tasks run sequentially so that each stage’s output feeds into the next.
 */
const job_definition = {
  inputSchema: {
    required: ['start_date', 'end_date', 'sma_window', 'symbols'],
    properties: {
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      sma_window: { type: 'number' },
      symbols: {type: 'array'}
    }
  },
  // Preprocessor ensures the sma_window is at least 1 (and can perform other normalization if needed)
  preprocessor: (rawInput) => {
    return {
      start_date: rawInput.start_date,
      end_date: rawInput.end_date,
      sma_window: Math.max(rawInput.sma_window, 1),
      symbols: rawInput.symbols
    };
  },
  stages: [
    {
      // Stage 1: Data ingestion and merging
      tasks: [Tasks.DATA_INGESTION_MERGE],
      callback: passthroughCallback
    },
    {
      // Stage 2: Daily aggregation & summarization
      tasks: [Tasks.DAILY_AGGREGATION],
      callback: passthroughCallback
    },
    {
      // Stage 3: Technical analysis & anomaly detection
      tasks: [Tasks.TECHNICAL_ANALYSIS],
      callback: passthroughCallback
    },
    {
      // Stage 4: Visualization data preparation
      tasks: [Tasks.VISUALIZATION_PREPARATION],
      callback: passthroughCallback
    }
  ]
};

const job_description = `
This "analysis_job" orchestrates a complete S&P 500 stock data analysis pipeline. It performs:
1. Data Ingestion & Merging: Reads intraday CSV data (reshaped_dataset.csv), company metadata (sp500_companies.csv), and index data (sp500_index.csv); filters by the specified date range and merges data on stock symbol.
2. Daily Aggregation & Summarization: Aggregates the intraday data into daily OHLCV records.
3. Technical Analysis & Anomaly Detection: Computes technical indicators like a Simple Moving Average (SMA) using a configurable window and flags volume anomalies.
4. Visualization Preparation: Converts the processed data into a JSON payload ready for frontend charts.
Input parameters include start_date, end_date, and sma_window. The tasks run sequentially so the output of one feeds into the next.
`;

module.exports = {
  job_definition,
  job_name: "analysis_job",
  job_description
};
