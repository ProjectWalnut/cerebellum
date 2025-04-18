/**
 * Synthetic Data Generator for S&P500 intraday data.
 * 
 * Revised to fetch only the past 15 days from the latest real day for each stock.
 * 
 * For each stock:
 *   - Option 1: Use the last real day (2018-02-16) to generate the first synthetic day (e.g. 2018-02-20) with small noise.
 *   - Option 2: For subsequent days, randomly sample a template day from the last 15 days (real + synthetic),
 *               calculate minute-by-minute percentage changes compared to the previous day in the sample,
 *               add a small noise, and apply these changes to the most recent synthetic day.
 *   - Insert the synthetic data into the same PostgreSQL table.
 */

const { Client } = require('pg');
const moment = require('moment');
const { lte } = require('lodash');

//
// ----- Configuration -----
//
const client = new Client({
  host: process.env.PG_HOST || 'postgres_db',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'admin',
  password: process.env.PG_PASSWORD || 'admin',
  database: process.env.PG_DATABASE || 'amp'
});

const tableName = 'stock_data';  // Adjust to your table name

// Trading session parameters (US market hours)
const TRADING_START = moment("09:30", "HH:mm");
const TRADING_END = moment("16:00", "HH:mm");
const MINUTES_PER_DAY = 390;  // atleast 380 from 9:30 to 16:00

// Synthetic generation parameters
const NUM_SYNTHETIC_DAYS = 1500; // Number of synthetic days to generate
const PERCENT_NOISE_STD = 0.002;  // ~0.2% standard deviation for price changes
const VOLUME_NOISE_STD = 0.05;    // ~5% noise for volume changes

// Starting date for synthetic generation (first synthetic day)
// Assuming the last real day is 2018-02-16, then first synthetic day is 2018-02-20
const FIRST_SYNTHETIC_DATE = moment("2018-02-20", "YYYY-MM-DD");

//
// ----- Helper Functions -----
//

// Box-Muller transformation to generate a random normal factor with mean 0
function randomNormalFactor(stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Returns a noise multiplier: 1 + noise
function noiseMultiplier(stdDev) {
  return 1 + randomNormalFactor(stdDev);
}

// Given a trading day date (moment) and minute index (0-indexed), returns the timestamp string for that minute.
function generateTimestampForMinute(tradingDay, minuteIndex) {
  let current = moment(tradingDay).set({
    hour: TRADING_START.hour(),
    minute: TRADING_START.minute(),
    second: 0,
    millisecond: 0
  });
  return current.add(minuteIndex, 'minutes').format("YYYY-MM-DD HH:mm:ss");
}

// Given two days’ data (arrays with 390 rows) compute the percentage changes per minute for parameters.
function computePctChanges(dayData, prevDayData) {
  let pctChanges = [];
  let min_day_cnt = Math.min(dayData.length, prevDayData.length);
  let prev_pct = {};
  for (let i = 0; i < MINUTES_PER_DAY; i++) {
    if (i < min_day_cnt) {
      let pct = {};
      ['open', 'high', 'low', 'close', 'volume'].forEach(param => {
        let prev = Number(prevDayData[i][param]);
        let curr = Number(dayData[i][param]);
        //pct[param] = prev === 0 ? 0 : (curr - prev) / prev;
        // raw pct
        let p = prev === 0 ? 0 : (curr - prev) / prev;
        // clip to ±2%
        pct[param] = Math.max(-0.02, Math.min(0.02, p));
      });
      pctChanges.push(pct);
      prev_pct = pct;
    } else {
      pctChanges.push(prev_pct);
    }

  }
  return pctChanges;
}

//
// ----- Main Synthetic Generation Function -----
//

async function generateSyntheticForStock(client, symbol) {
  console.log(`Processing stock: ${symbol}`);

  // Query only the past 15 days from the latest real day (2018-02-16 and 14 days before it).
  const past15DaysQuery = `
    SELECT *
    FROM ${tableName}
    WHERE stock_symbol = $1 AND timestamp::date BETWEEN (DATE '2018-02-16' - INTERVAL '14 days') AND DATE '2018-02-16'
    ORDER BY timestamp ASC
  `;
  const res = await client.query(past15DaysQuery, [symbol]);
  const rows = res.rows;

  // Group rows by day.
  const dayGroups = {};
  rows.forEach(row => {
    const day = moment(row.timestamp, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD");
    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push(row);
  });

  // Ensure we have complete trading days (each with 390 records).
  let realDays = Object.keys(dayGroups).sort();
  realDays = realDays.filter(day => dayGroups[day].length >= 380);

  // The last real day must be 2018-02-16.
  const lastRealDayStr = "2018-02-16";
  if (!dayGroups[lastRealDayStr] || dayGroups[lastRealDayStr].length < MINUTES_PER_DAY) {
    if (!dayGroups[lastRealDayStr]) {
      return;
    }
    console.warn(`Data for last real day ${lastRealDayStr} is slightly incomplete (${dayGroups[lastRealDayStr]?.length || 0} minutes), but proceeding anyway.`);
    //return;
  }

  // Initialize sample pool with the 15 real days.
  let samplePool = realDays.map(day => ({ date: day, data: dayGroups[day] }));

  // For continuity, the "latest" day is initially the last real day.
  let latestDayData = dayGroups[lastRealDayStr];

  // Hold synthetic days that we generate.
  let syntheticDays = [];

  // ---- Option 1: First Synthetic Day using Continuity ----
  let syntheticDate = FIRST_SYNTHETIC_DATE.clone();
  let firstSyntheticDay = [];

  for (let i = 0; i < MINUTES_PER_DAY; i++) {
    let realRow;
    if (i < latestDayData.length) {
      realRow = latestDayData[i];
    } else {
      realRow = latestDayData[latestDayData.length - 1];
    }
    if (!realRow) {
      console.log("here");
    }
    let newTimestamp = generateTimestampForMinute(syntheticDate, i);

    let newRow = {
      timestamp: newTimestamp,
      stock_symbol: symbol,
      open: Number(realRow.open) * noiseMultiplier(PERCENT_NOISE_STD),
      high: Number(realRow.high) * noiseMultiplier(PERCENT_NOISE_STD),
      low: Number(realRow.low) * noiseMultiplier(PERCENT_NOISE_STD),
      close: Number(realRow.close) * noiseMultiplier(PERCENT_NOISE_STD),
      volume: Math.round(Number(realRow.volume) * noiseMultiplier(VOLUME_NOISE_STD))
    };
    firstSyntheticDay.push(newRow);
  }

  syntheticDays.push({ date: syntheticDate.format("YYYY-MM-DD"), data: firstSyntheticDay });
  // samplePool.push({ date: syntheticDate.format("YYYY-MM-DD"), data: firstSyntheticDay });
  if (samplePool.length > 15) samplePool.shift();
  latestDayData = firstSyntheticDay;
  console.log(`Generated first synthetic day for ${symbol}: ${syntheticDate.format("YYYY-MM-DD")}`);

  // ---- Option 2: Generate Subsequent Synthetic Days ----
  for (let d = 2; d <= NUM_SYNTHETIC_DAYS; d++) {
    syntheticDate = syntheticDate.add(1, 'days');
    while (syntheticDate.day() === 0 || syntheticDate.day() === 6) { // Skip weekends.
      syntheticDate = syntheticDate.add(1, 'days');
    }

    // Ensure the sample pool has at least 2 days.
    if (samplePool.length < 2) {
      console.error(`Insufficient days in sample pool for ${symbol}.`);
      break;
    }

    // Randomly select a template day from the sample pool (avoid index 0 to ensure a predecessor exists).
    let templateIndex = Math.floor(Math.random() * (samplePool.length - 1)) + 1;
    let templateDay = samplePool[templateIndex].data;
    let prevTemplateDay = samplePool[templateIndex - 1].data;

    // Compute percentage changes for each minute between the template day and its previous day.
    let pctChanges = computePctChanges(templateDay, prevTemplateDay);

    // Apply these percentage changes (with extra noise) to the latest synthetic day.
    let newSyntheticDay = [];
    for (let i = 0; i < MINUTES_PER_DAY; i++) {
      let pct = pctChanges[i];
      let newRow = {};
      newRow.timestamp = generateTimestampForMinute(syntheticDate, i);
      newRow.stock_symbol = symbol;

      ['open', 'high', 'low', 'close'].forEach(param => {
        let noisyPct = pct[param] * (1 + randomNormalFactor(PERCENT_NOISE_STD));
        newRow[param] = latestDayData[i][param] * (1 + noisyPct);
      });

      let noisyPctVolume = pct['volume'] * (1 + randomNormalFactor(VOLUME_NOISE_STD));
      newRow.volume = Math.round(latestDayData[i]['volume'] * (1 + noisyPctVolume));
      newSyntheticDay.push(newRow);
    }

    syntheticDays.push({ date: syntheticDate.format("YYYY-MM-DD"), data: newSyntheticDay });
    //samplePool.push({ date: syntheticDate.format("YYYY-MM-DD"), data: newSyntheticDay });
    if (samplePool.length > 15) samplePool.shift();
    latestDayData = newSyntheticDay;
    console.log(`Generated synthetic day ${d} for ${symbol}: ${syntheticDate.format("YYYY-MM-DD")}`);
  }

  // ---- Insert the synthetic records into PostgreSQL ----
  // const allSyntheticRecords = syntheticDays.flatMap(day => day.data);
  // for (let rec of allSyntheticRecords) {
  //   console.log(rec);
  //   // await client.query(
  //   //   `INSERT INTO ${tableName} (timestamp, stock_symbol, open, high, low, close, volume)
  //   //    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  //   //   [
  //   //     rec.timestamp,
  //   //     rec.stock_symbol,
  //   //     rec.open,
  //   //     rec.high,
  //   //     rec.low,
  //   //     rec.close,
  //   //     rec.volume
  //   //   ]
  //   // );
  // }
  // console.log(`Inserted ${allSyntheticRecords.length} synthetic records for stock ${symbol}`);

  // ---- Bulk‑insert synthetic records in chunks ----
  const allSyntheticRecords = syntheticDays.flatMap(day => day.data);
  const chunkSize = 7000;  // safe range: 5k–8k rows per INSERT

  for (let offset = 0; offset < allSyntheticRecords.length; offset += chunkSize) {
    const chunk = allSyntheticRecords.slice(offset, offset + chunkSize);

    // build placeholders and values array
    const values = [];
    const placeholders = chunk.map((rec, idx) => {
      const base = idx * 7;
      values.push(
        rec.timestamp,
        rec.stock_symbol,
        rec.open,
        rec.high,
        rec.low,
        rec.close,
        rec.volume
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(',\n');

    const insertQuery = `
    INSERT INTO ${tableName}
      (timestamp, stock_symbol, open, high, low, close, volume)
    VALUES
      ${placeholders}
    ON CONFLICT (timestamp, stock_symbol) DO UPDATE SET
      open   = EXCLUDED.open,
      high   = EXCLUDED.high,
      low    = EXCLUDED.low,
      close  = EXCLUDED.close,
      volume = EXCLUDED.volume
  `;

    await client.query(insertQuery, values);
  }

  console.log(`Inserted ${allSyntheticRecords.length} synthetic records for stock ${symbol}`);

}

//
// ----- Main Function -----
//

async function main() {
  const client = new Client({
    host: process.env.PG_HOST || 'postgres_db',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'admin',
    password: process.env.PG_PASSWORD || 'admin',
    database: process.env.PG_DATABASE || 'amp'
  });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    const startFromSymbol = "DVN" || null; // pass symbol as arg, or null to run all
    let skip = Boolean(startFromSymbol);

    // Query distinct stock symbols.
    const res = await client.query(`SELECT DISTINCT stock_symbol FROM ${tableName}`);
    let symbols = res.rows.map(row => row.stock_symbol);
    symbols = ["AAPL", "NVDA", "MSFT", "GOOGL", "TSLA", "GM", "AMZN", "WMT", "META", "SNAP", "AMD", "JPM", "GS", "XOM", "CVX", "NFLX", "DIS", "SQ", "PYPL", "BABA", "MU", "FB", "TWTR"];
    for (const symbol of symbols) {
      // if (skip) {
      //   if (symbol !== startFromSymbol) {
      //     console.log(`Skipping ${symbol}`);
      //     continue;
      //   } else {
      //     skip = false;
      //   }
      // }

      console.log(`Processing ${symbol}`);
      await generateSyntheticForStock(client, symbol);
    }
    console.log("Synthetic data generation completed.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
    console.log("Disconnected from PostgreSQL");
  }
}

main();
