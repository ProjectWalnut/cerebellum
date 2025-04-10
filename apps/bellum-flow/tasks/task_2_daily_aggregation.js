const task2_daily_aggregation = async (input) => {
    // input: mergedData array from task 1
    const mergedData = input.mergedData;
    const groups = {};
  
    // Group records by date (ISO string) and stock_symbol
    mergedData.forEach(rec => {
      const dateStr = rec.date.toISOString().slice(0,10); // YYYY-MM-DD
      const key = `${dateStr}_${rec.stock_symbol}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    });
  
    const dailySummary = [];
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      // sort by timestamp ascending
      group.sort((a, b) => a.timestamp - b.timestamp);
      // Ensure numeric fields are parsed as numbers
      const open = parseFloat(group[0].open);
      const high = Math.max(...group.map(r => parseFloat(r.high)));
      const low = Math.min(...group.map(r => parseFloat(r.low)));
      const close = parseFloat(group[group.length - 1].close);
      const volume = group.reduce((sum, r) => sum + parseFloat(r.volume), 0);
      dailySummary.push({
        date: group[0].date.toISOString().slice(0,10),
        stock_symbol: group[0].stock_symbol,
        open, high, low, close, volume
      });
    });
  
    return { dailyData: dailySummary };
  };
  
  task2_daily_aggregation.inputSchema = {
    required: ['mergedData'],
    properties: {
      mergedData: { type: 'array' }
    }
  };
  
  task2_daily_aggregation.outputSchema = {
    required: ['dailyData'],
    properties: {
      dailyData: { type: 'array' }
    }
  };
  
  module.exports = task2_daily_aggregation;
  module.exports.task_name = "DAILY_AGGREGATION";
  