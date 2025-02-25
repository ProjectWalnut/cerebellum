// Sample task functions
const incrementTaskFn = async (input) => {
  let output = {};
  output.number = input.number + 1;
  return output;
};

// Define optional input schema
incrementTaskFn.inputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

// Define optional output schema
incrementTaskFn.outputSchema = {
  required: ['number'],
  properties: {
    number: { type: 'number' }
  }
};

module.exports = incrementTaskFn;
// This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
module.exports.task_name = "INCREMENT";

// * New developers: Each task file MUST export a property called `task_name`.
// * For example, in your task file:
// *
// *    module.exports.task_name = "INCREMENT";
// *    module.exports = function(input) { ... };
// *
// * If a task file doesn't export `task_name`, an error is thrown.
