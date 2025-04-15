const ArgsFn = async (input, args) => {
    let output = {};
    output.text = args.text;
    return output;
  };
  
  module.exports = ArgsFn;
  // This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
  module.exports.task_name = "ARGSFN";
  
  // * New developers: Each task file MUST export a property called `task_name`.
  // * For example, in your task file:
  // *
  // *    module.exports.task_name = "INCREMENT";
  // *    module.exports = function(input) { ... };
  // *
  // * If a task file doesn't export `task_name`, an error is thrown.