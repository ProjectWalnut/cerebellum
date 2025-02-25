const doubleTaskFn = async (input) => {
  let output = {};
  // Randomly fail to simulate a transient error.
  if (Math.random() < 0.5) {
    throw new Error('Simulated random failure in doubleTaskFn. Hey dev! Come check me in sampleTask_DoubleFn.js');
  }
  output.number = input.number * 2;
  return output;
};

// Define optional input schema
doubleTaskFn.inputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

// Define optional output schema
doubleTaskFn.outputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

module.exports = doubleTaskFn;
// This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
module.exports.task_name = "DOUBLE";

// * New developers: Each task file MUST export a property called `task_name`.
// * For example, in your task file:
// *
// *    module.exports.task_name = "INCREMENT";
// *    module.exports = function(input) { ... };
// *
// * If a task file doesn't export `task_name`, an error is thrown.
