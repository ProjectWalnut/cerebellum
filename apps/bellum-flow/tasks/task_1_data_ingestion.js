const fs = require('fs').promises;
const { parse } = require('csv-parse');
const { Client } = require('pg');

// Utility function to parse CSV into an array of objects
async function parseCSV(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    parse(content, {
      columns: true,
      skip_empty_lines: true
    }, (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

const dataIngestionTaskFn = async (input) => {
  // Validate input dates.
  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error(`Invalid input dates: ${input.start_date}, ${input.end_date}`);
  }

  // Validate and prepare the symbols input.
  const symbols = input.symbols.map(s => s.trim().toUpperCase());
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error("Input 'symbols' must be a non-empty array of strings.");
  }

  // Load S&P 500 index data from CSV.
  const indexRecords = await parseCSV('/workspace/cerebellum/apps/bellum-flow/data/snp500/sp500_index.csv');
  indexRecords.forEach(rec => { 
    rec.Date = new Date(rec.Date);
  });

  // Load S&P 500 companies metadata from CSV and only keep the ones for the provided symbols.
  let companiesRecords = await parseCSV('/workspace/cerebellum/apps/bellum-flow/data/snp500/sp500_companies.csv');
  companiesRecords = companiesRecords
    .map(rec => ({ ...rec, Symbol: rec.Symbol.trim().toUpperCase() }))
    .filter(rec => symbols.includes(rec.Symbol));

  // Build a lookup object for companies metadata.
  const companiesMap = companiesRecords.reduce((acc, comp) => {
    acc[comp.Symbol] = comp;
    return acc;
  }, {});

  // --- Query intraday data from PostgreSQL / TimescaleDB ---
  const client = new Client({
    host: process.env.PG_HOST || 'postgres_db',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'admin',
    password: process.env.PG_PASSWORD || 'admin',
    database: process.env.PG_DATABASE || 'amp'
  });
  await client.connect();

  const queryText = `
    SELECT "timestamp", stock_symbol, close, high, low, open, volume
    FROM public.stock_data
    WHERE "timestamp" BETWEEN $1 AND $2
      AND stock_symbol = ANY($3)
    ORDER BY "timestamp" ASC
  `;
  const res = await client.query(queryText, [
    startDate.toISOString(),
    endDate.toISOString(),
    symbols
  ]);
  await client.end();

  // Process retrieved rows: convert timestamp and calculate date field.
  const intradayRecords = res.rows.map(rec => {
    const timestamp = new Date(rec.timestamp);
    // Create a date field with only the year, month, day.
    const date = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
    return { ...rec, timestamp, date };
  });

  // Merge intraday data with companies metadata in chunks.
  const chunkSize = 10000; // Adjust the chunk size as needed.
  let mergedData = [];
  for (let i = 0; i < intradayRecords.length; i += chunkSize) {
    const chunk = intradayRecords.slice(i, i + chunkSize);
    const mergedChunk = chunk.map(record => {
      // Quick lookup in companiesMap.
      const comp = companiesMap[record.stock_symbol];
      if (!comp) {
        // Optionally warn for unmatched symbols.
        // console.warn(`[WARN] No company match for stock_symbol: ${record.stock_symbol}`);
      }
      return { ...record, ...(comp || {}) };
    });
    mergedData = mergedData.concat(mergedChunk);
  }

  return { mergedData, indexData: indexRecords, companiesData: companiesRecords };
};

// Input schema with mandatory symbols.
dataIngestionTaskFn.inputSchema = {
  required: ['start_date', 'end_date', 'symbols'],
  properties: {
    start_date: { type: 'string' },
    end_date: { type: 'string' },
    symbols: { 
      type: 'array', 
      items: { type: 'string' },
      minItems: 1 
    }
  }
};

// Output schema
dataIngestionTaskFn.outputSchema = {
  required: ['mergedData', 'indexData', 'companiesData'],
  properties: {
    mergedData: { type: 'array' },
    indexData: { type: 'array' },
    companiesData: { type: 'array' }
  }
};

module.exports = dataIngestionTaskFn;
module.exports.task_name = "DATA_INGESTION_MERGE";
