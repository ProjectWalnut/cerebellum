const Task = require('./Task'); // adjust the path if necessary
const Stage = require('./Stage');

/**
 * Resolves and instantiates a single task definition using the provided registry.
 * For example:
 *   - If task is a string, returns an instantiated Task with that name and function.
 *   - If task is an object with a 'fn' property, instantiates a Task using the fn (and fallbackFn, if any),
 *     and passes along an optional `args` property.
 */
function resolveAndInstantiateTask(task, registry) {
  if (typeof task === "string") {
    const fn = registry[task.toUpperCase()];
    if (!fn) {
      throw new Error(`Task "${task}" not found in registry.`);
    }
    return new Task(task, fn);
  } else if (typeof task === "object" && task.fn) {
    const fn = registry[task.fn.toUpperCase()];
    if (!fn) {
      throw new Error(`Task "${task.fn}" not found in registry.`);
    }
    const options = {};
    if (task.fallbackFn) {
      const fb = registry[task.fallbackFn.toUpperCase()];
      if (!fb) {
        throw new Error(`Fallback task "${task.fallbackFn}" not found in registry.`);
      }
      options.fallbackFn = fb;
    }
    // New: Pass along optional args if provided.
    if (task.args) {
      options.args = task.args;
    }
    return new Task(task.fn, fn, options);
  } else {
    throw new Error("Unrecognized task definition format.");
  }
}

/**
 * Wraps the nextTasks function so that its return value is resolved and instantiated.
 * The nextTasks function from the raw job definition may return a string or an array of strings/objects.
 */
function wrapNextTasks(nextTasks, registry) {
  return function (context) {
    let out = nextTasks(context);
    if (!out) return [];
    if (typeof out === "string") out = [out];
    if (Array.isArray(out)) {
      return out.map(taskDef => resolveAndInstantiateTask(taskDef, registry));
    }
    return [];
  };
}

function buildJobStages(jobDefinition, registry) {
  const resolvedStages = jobDefinition.stages.map((stage, index) => {
    const resolvedTasks = stage.tasks.map(task => resolveAndInstantiateTask(task, registry));
    const wrappedNextTasks = stage.nextTasks ? wrapNextTasks(stage.nextTasks, registry) : null;

    let name = stage.name || `Stage ${index + 1}`;
    return new Stage(name, resolvedTasks, stage.callback, stage.mode, wrappedNextTasks);
  });

  return resolvedStages;
}

module.exports = {
  buildJobStages
};
