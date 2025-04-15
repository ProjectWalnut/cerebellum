const Tasks = require("../enums/taskEnums");

const passthroughCallback = (context) => {
  // Simply return the first result from the dynamic tasks.
  return context.previous;
};

const job_name = "sample_dynamic_tasks_jobs";

const job_definition = {
  inputSchema: {
    required: ['texts'],
    properties: {
      texts: { type: 'array'},
      loggingEnabled: { type: 'boolean' }
    }
  },
  preprocessor: (rawInput) => {
    // Pass the texts array and logging flag along.
    return { 
      texts: rawInput.texts,
      loggingEnabled: rawInput.loggingEnabled || false 
    };
  },
  stages: [
    {
      mode: "conditional",
      // Initially no tasks are preset; they will be generated dynamically.
      tasks: [],
      nextTasks: (context) => {
        // Generate dynamic tasks only once by checking a context flag.
        if (!context.dynamicDone && context.initial.texts && context.initial.texts.length > 0) {
          context.dynamicDone = true;
          // For each text, create a parameterized task.
          return context.initial.texts.map(text => {
            return { fn: "ARGSFN", args: { text } };
          });
        }
        // No more dynamic tasks to process.
        return [];
      },
      callback: passthroughCallback
    }
  ]
};

const job_description = `This job dynamically creates tasks based on an array of texts. Each dynamic task calls the ArgsFn function (exported as "ARGSFN") with a parameterized argument "text". The ArgsFn task simply prints (or returns) the passed text.`;


module.exports = {
  job_definition,
  job_name,
  job_description
};
