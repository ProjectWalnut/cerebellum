const doubleFallback = async (input, error) => {
  let output = {};
  console.log(`Fallback for doubleTaskFn triggered due to error: ${error.message}`);

  // As a simple fallback, return the input unchanged.
  output.number = input.number;
  return output;
};

// Define optional input schema
doubleFallback.inputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

// Define optional output schema
doubleFallback.outputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

module.exports = doubleFallback;
// This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
module.exports.task_name = "FALLBACK_FOR_DOUBLE";

// * New developers: Each task file MUST export a property called `task_name`.
// * For example, in your task file:
// *
// *    module.exports.task_name = "INCREMENT";
// *    module.exports = function(input) { ... };
// *
// * If a task file doesn't export `task_name`, an error is thrown.
