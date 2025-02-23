
const decrementTaskFn = async (input) => {
    return input - 3;
  };

  module.exports = decrementTaskFn;
  // This should be the name you add to taskEnums.js on the right side i.e. as value of the Key
  module.exports.task_name = "DECREMENT";

  // * New developers: Each task file MUST export a property called `task_name`.
  // * For example, in your task file:
  // *
  // *    module.exports.task_name = "INCREMENT";
  // *    module.exports = function(input) { ... };
  // *
  // * If a task file doesn't export `task_name`, an error is thrown.