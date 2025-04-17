const { Client } = require('pg');
const moment = require('moment');

/**
 * detectCorrelationShift - Task to detect sudden changes in correlation between two stocks.
 *
 * @param {Object} input - The job input context.
 *     Expects: { startTime: string, endTime: string, ... }
 * @param {Object} args - Additional parameters:
 *    - stockA: string        // first stock symbol (e.g., "AAPL")
 *    - stockB: string        // second stock symbol (e.g., "NVDA")
 *    - windowSize: number    // Number of minutes in the sliding window (default: 5)
 *    - shiftThreshold: number// Minimum change in correlation to flag an anomaly (default: 0.5)
 *    - chunkSizeHours: number// Hours per data chunk (default: 6)
 *
 * This function:
 *   1. Processes data in contiguous chunks.
 *   2. For each chunk, queries one-minute closing prices for stockA and stockB.
 *   3. Merges the two results by matching timestamps.
 *   4. Uses an incremental sliding-window update for Pearson correlation.
 *   5. If the absolute difference between the current and previous window correlation exceeds shiftThreshold
 *      (and we are not already in a spike event), an anomaly is recorded.
 *
 * Returns an object: { stockPair: string, anomalies: Array }
 */
const detectCorrelationShift = async (input, args) => {
  const stockA = args.stockA;
  const stockB = args.stockB;
  const windowSize = args.windowSize || 5;
  const shiftThreshold = args.shiftThreshold || 0.5;
  const chunkSizeHours = args.chunkSizeHours || 6;

  const globalStart = moment(input.startTime);
  const globalEnd = moment(input.endTime);
  let currentStart = globalStart.clone();

  const client = new Client({
    host: process.env.PG_HOST || 'postgres_db',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'admin',
    password: process.env.PG_PASSWORD || 'admin',
    database: process.env.PG_DATABASE || 'amp'
  });
  await client.connect();

  let anomalies = [];

  // Sliding window buffers and running aggregates.
  let windowBufferA = [];
  let windowBufferB = [];
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  let prevCorr = null;
  let inSpike = false;
  let totalRowsProcessed = 0;
  while (currentStart.isBefore(globalEnd)) {
    const currentEnd = moment.min(currentStart.clone().add(chunkSizeHours, 'hours'), globalEnd);

    // Query prices for stockA.
    const resA = await client.query(`
      SELECT timestamp, close
      FROM stock_data
      WHERE stock_symbol = $1
        AND timestamp >= $2
        AND timestamp < $3
      ORDER BY timestamp ASC
    `, [stockA, currentStart.format('YYYY-MM-DD HH:mm:ss'), currentEnd.format('YYYY-MM-DD HH:mm:ss')]);

    // Query prices for stockB.
    const resB = await client.query(`
      SELECT timestamp, close
      FROM stock_data
      WHERE stock_symbol = $1
        AND timestamp >= $2
        AND timestamp < $3
      ORDER BY timestamp ASC
    `, [stockB, currentStart.format('YYYY-MM-DD HH:mm:ss'), currentEnd.format('YYYY-MM-DD HH:mm:ss')]);

    const rowsA = resA.rows;
    const rowsB = resB.rows;

    // Merge rows by timestamp. We assume matching timestamps.
    let merged = [];
    let idxA = 0, idxB = 0;
    while (idxA < rowsA.length && idxB < rowsB.length) {
      const timeA = moment(rowsA[idxA].timestamp);
      const timeB = moment(rowsB[idxB].timestamp);
      if (timeA.isSame(timeB)) {
        merged.push({
          timestamp: rowsA[idxA].timestamp,
          priceA: Number(rowsA[idxA].close),
          priceB: Number(rowsB[idxB].close)
        });
        idxA++;
        idxB++;
      } else if (timeA.isBefore(timeB)) {
        idxA++;
      } else {
        idxB++;
      }
    }

    // Process merged rows sequentially.
    totalRowsProcessed += merged.length;
    for (let i = 0; i < merged.length; i++) {
      const row = merged[i];
      const priceA = row.priceA;
      const priceB = row.priceB;

      // Build up the sliding window until full.
      if (windowBufferA.length < windowSize) {
        windowBufferA.push(priceA);
        windowBufferB.push(priceB);
        sumA += priceA;
        sumB += priceB;
        sumAB += priceA * priceB;
        sumA2 += priceA * priceA;
        sumB2 += priceB * priceB;
        if (windowBufferA.length < windowSize) continue; // wait until full
      }

      // Now compute the Pearson correlation from aggregates.
      let currCorr = 0;
      const numerator = windowSize * sumAB - sumA * sumB;
      const denominator = Math.sqrt((windowSize * sumA2 - sumA * sumA) * (windowSize * sumB2 - sumB * sumB));
      if (denominator === 0) {
        currCorr = 0;
      } else {
        currCorr = numerator / denominator;
      }

      if (prevCorr !== null && Math.abs(currCorr - prevCorr) > shiftThreshold && !inSpike) {
        anomalies.push({
          timestamp: row.timestamp,
          prevCorr,
          currCorr,
          shift: Math.abs(currCorr - prevCorr)
        });
        inSpike = true;
      } else if (prevCorr !== null && Math.abs(currCorr - prevCorr) <= shiftThreshold) {
        inSpike = false;
      }
      // Update prevCorr.
      prevCorr = currCorr;

      // Incremental update: slide the window.
      // Remove oldest values.
      const oldA = windowBufferA.shift();
      const oldB = windowBufferB.shift();
      sumA -= oldA;
      sumB -= oldB;
      sumAB -= oldA * oldB;
      sumA2 -= oldA * oldA;
      sumB2 -= oldB * oldB;

      // Add current row's values.
      windowBufferA.push(priceA);
      windowBufferB.push(priceB);
      sumA += priceA;
      sumB += priceB;
      sumAB += priceA * priceB;
      sumA2 += priceA * priceA;
      sumB2 += priceB * priceB;
    }
    currentStart = currentEnd;
  }

  await client.end();
  return { stockPair: `${stockA}-${stockB}`, anomalies, totalRowsProcessed };
};

module.exports = detectCorrelationShift;
module.exports.task_name = "SUDDEN_CORRELATION_SHIFT";
