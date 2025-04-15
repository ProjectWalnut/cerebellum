const { Client } = require('pg');
const moment = require('moment');

// 1) Simple function to produce time chunks
function timeChunks(startTime, endTime, chunkSizeHours) {
  const chunks = [];
  let currentStart = moment(startTime);
  const finalEnd = moment(endTime);
  
  while (currentStart.isBefore(finalEnd)) {
    let currentEnd = moment(currentStart).add(chunkSizeHours, 'hours');
    if (currentEnd.isAfter(finalEnd)) {
      currentEnd = finalEnd;
    }
    chunks.push([currentStart.format('YYYY-MM-DD HH:mm:ss'), currentEnd.format('YYYY-MM-DD HH:mm:ss')]);
    currentStart = currentEnd;
  }
  return chunks;
}

// 2) Process the chunks with minimal function calls
const processOHLCValidation = async (input) => {

  let startTime = input.startTime;
  let endTime = input.endTime;
  let chunkSizeHours = 12;
    // Setup simple PG client configuration (update as needed)
    const pgClient = new Client({
        host: process.env.PG_HOST || 'postgres_db',
        port: process.env.PG_PORT || 5432,
        user: process.env.PG_USER || 'admin',
        password: process.env.PG_PASSWORD || 'admin',
        database: process.env.PG_DATABASE || 'amp'
    });
    await pgClient.connect();

  const anomalies = {}; // We will store anomalies keyed by chunk range.
  const chunks = timeChunks(startTime, endTime, chunkSizeHours);
  
  let promises = [];
  
  for (let c = 0; c < chunks.length; c++) {
    const chunkStart = chunks[c][0];
    const chunkEnd = chunks[c][1];
    
    // Create a promise for each chunk
    let p = new Promise(async (resolve, reject) => {
      try {
        // a) Query the database for this chunk.
        let queryText = `
          SELECT *
          FROM stock_data
          WHERE timestamp >= $1
            AND timestamp < $2
        `;
        console.log(`Processing chunk index ${c} (${chunkStart} - ${chunkEnd})`);
        let result = await pgClient.query(queryText, [chunkStart, chunkEnd]);
        let rows = result.rows;
        
        // b) Iterate over rows with a basic for loop, inlining validation logic.
        // Check that low <= open and low <= close and high >= open and high >= close.
        let chunkKey = chunkStart + " - " + chunkEnd;
        for (let i = 0; i < rows.length; i++) {
          let row = rows[i];
          // Convert values to numbers if not already.
          let openVal = +row.open, closeVal = +row.close, highVal = +row.high, lowVal = +row.low;
          if (lowVal > openVal || lowVal > closeVal || highVal < openVal || highVal < closeVal) {
            // If anomaly, record row index and minimal details.
            if (!anomalies[chunkKey]) {
              anomalies[chunkKey] = [];
            }
            anomalies[chunkKey].push({ rowNumber: i, stock_symbol: row.stock_symbol, timestamp: row.timestamp });
          }
        }
        // d) Release memory by letting rows go out of scope (garbage collected automatically).
        console.log(`FINISHED PROCESSING ${c} (${chunkStart} - ${chunkEnd})`);
        resolve();
      } catch (e) {
        console.error("Error processing chunk " + chunkStart + " - " + chunkEnd + ": ", e);
        resolve(); // resolve to allow other promises to finish
      }
    });
    promises.push(p);
  }
  
  // Wait for all chunks to process
  await Promise.all(promises);
  return anomalies;
}

processOHLCValidation.inputSchema = {
    required: ['startTime', 'endTime'],
    properties: {
        startTime: { type: 'string' },
        endTime: {type: 'string'}
    }
};

processOHLCValidation.outputSchema = {
    required: ['anomalies'],
    properties: {
        anomalies: { type: 'object' },
    }
};


module.exports = processOHLCValidation;
// This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
module.exports.task_name = "OHLC";
// // Example usage:
// (async () => {
//   const startTime = "2017-09-12 00:00:00";
//   const endTime   = "2018-02-15 23:59:59";
//   const chunkSizeHours = 6; // adjust chunk size if needed
  
//   let anomalies = await processOHLCValidation(startTime, endTime, chunkSizeHours);
//   console.log("Anomalies found:", anomalies);
  
//   await pgClient.end();
// })();
