const { Client } = require('pg');
const moment = require('moment');

const detectVolumeSpike = async (input, args) => {
  const stock = args.stock;
  const windowSize = args.windowSize || 20;
  const thresholdFactor = args.thresholdFactor || 3;
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

  // Sliding window state
  let windowBuffer = [];
  let rollingSum = 0;
  let rollingSumSq = 0;
  let inSpike = false;

  while (currentStart.isBefore(globalEnd)) {
    const currentEnd = moment.min(currentStart.clone().add(chunkSizeHours, 'hours'), globalEnd);

    const res = await client.query(`
      SELECT timestamp, volume
      FROM stock_data
      WHERE stock_symbol = $1
        AND timestamp >= $2
        AND timestamp < $3
      ORDER BY timestamp ASC
    `, [stock, currentStart.format('YYYY-MM-DD HH:mm:ss'), currentEnd.format('YYYY-MM-DD HH:mm:ss')]);

    const rows = res.rows;

    for (let i = 0; i < rows.length; i++) {
      const vol = Number(rows[i].volume);

      if (windowBuffer.length < windowSize) {
        windowBuffer.push(vol);
        rollingSum += vol;
        rollingSumSq += vol * vol;
        continue;
      }

      const mean = rollingSum / windowSize;
      const variance = (rollingSumSq / windowSize) - (mean * mean);
      const std = Math.sqrt(variance);
      const threshold = mean + thresholdFactor * std;

      if (vol > threshold && !inSpike) {
        anomalies.push({
          timestamp: rows[i].timestamp,
          volume: vol,
          mean,
          std,
          threshold
        });
        inSpike = true;
      } else if (vol <= threshold) {
        inSpike = false;
      }

      // Slide the window
      const oldest = windowBuffer.shift();
      rollingSum -= oldest;
      rollingSumSq -= oldest * oldest;

      windowBuffer.push(vol);
      rollingSum += vol;
      rollingSumSq += vol * vol;
    }

    currentStart = currentEnd;
  }

  await client.end();
  return { stock, anomalies };
};

module.exports = detectVolumeSpike;
module.exports.task_name = "VOLUME_SPIKE_DETECTOR";
