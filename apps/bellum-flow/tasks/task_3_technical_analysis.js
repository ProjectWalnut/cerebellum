const task3_technical_analysis = async (input) => {
    // input: dailyData array, and optional parameter sma_window (number)
    const dailyData = input.dailyData;
    const smaWindow = input.__initialInput.sma_window || 5;
    
    // Group dailyData by stock_symbol
    const groups = {};
    dailyData.forEach(rec => {
      const sym = rec.stock_symbol;
      if (!groups[sym]) groups[sym] = [];
      groups[sym].push(rec);
    });
    
    const techData = [];
    Object.keys(groups).forEach(sym => {
      let group = groups[sym];
      // Sort by date ascending
      group.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Compute rolling SMA for close and rolling mean for volume
      for (let i = 0; i < group.length; i++) {
        if (i >= smaWindow - 1) {
          let sumClose = 0;
          let sumVolume = 0;
          for (let j = i - smaWindow + 1; j <= i; j++) {
            sumClose += parseFloat(group[j].close);
            sumVolume += parseFloat(group[j].volume);
          }
          group[i].SMA = sumClose / smaWindow;
          group[i].VolumeMean = sumVolume / smaWindow;
        } else {
          group[i].SMA = null;
          group[i].VolumeMean = null;
        }
        // Flag anomaly if volume > 3 times VolumeMean (if available)
        if (group[i].VolumeMean !== null) {
          group[i].Anomaly = parseFloat(group[i].volume) > (3 * group[i].VolumeMean);
        } else {
          group[i].Anomaly = false;
        }
        techData.push(group[i]);
      }
    });
    
    return { techData };
  };
  
  task3_technical_analysis.inputSchema = {
    required: ['dailyData'],
    properties: {
      dailyData: { type: 'array' },
      sma_window: { type: 'number' }
    }
  };
  
  task3_technical_analysis.outputSchema = {
    required: ['techData'],
    properties: {
      techData: { type: 'array' }
    }
  };
  
  module.exports = task3_technical_analysis;
  module.exports.task_name = "TECHNICAL_ANALYSIS";
  