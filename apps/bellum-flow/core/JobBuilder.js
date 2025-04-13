const fs = require('fs');
const path = require('path');
const Task = require('./Task');

/**
 * Builds a tasks registry by reading all JS files in the tasks directory.
 * Each task module must export a property `task_name`.
 */
async function buildTasksRegistry() {
  const tasksDir = path.join(__dirname, '../tasks');
  const taskFiles = fs.readdirSync(tasksDir);
  const registry = {};

  for (let file of taskFiles) {
    if (file.endsWith('.js')) {
      const taskModule = require(path.join(tasksDir, file));
      if (!taskModule.task_name) {
        throw new Error(`Task file "${file}" does not export a "task_name" property.`);
      }
      const taskName = taskModule.task_name.toUpperCase(); // Normalize to uppercase
      registry[taskName] = taskModule;
    }
  }
  return registry;
}

/**
 * Resolves a single task definition using the provided registry.
 * For stage.tasks (used in parallel mode), we return a plain object
 * which will later be instantiated into a Task via Job.js.
 *
 * For example:
 *   - If task is a string, returns { name, fn }.
 *   - If task is an object with a 'fn' property, it returns an object
 *     with properties 'name', 'fn', and (optionally) 'fallbackFn'.
 */
function resolveTask(task, registry) {
  if (typeof task === "string") {
    const fn = registry[task.toUpperCase()];
    if (!fn) {
      throw new Error(`Task "${task}" not found in registry.`);
    }
    return { name: task, fn };
  } else if (typeof task === "object" && task.fn) {
    const fn = registry[task.fn.toUpperCase()];
    if (!fn) {
      throw new Error(`Task "${task.fn}" not found in registry.`);
    }
    const resolved = { name: task.fn, fn };
    if (task.fallbackFn) {
      const fallback = registry[task.fallbackFn.toUpperCase()];
      if (!fallback) {
        throw new Error(`Fallback task "${task.fallbackFn}" not found in registry.`);
      }
      resolved.fallbackFn = fallback;
    }
    return resolved;
  } else {
    return task; // Already resolved or invalid definition.
  }
}

/**
 * Wraps the nextTasks function so that its return value is resolved via the registry,
 * and (critically) returns an array of Task *instances*.
 * The nextTasks function from the raw job definition may return a string or an
 * array of strings or objects. We convert each to a new Task instance.
 */
function wrapNextTasks(nextTasks, registry) {
  return function (context) {
    let out = nextTasks(context);
    if (!out) return [];
    if (typeof out === "string") out = [out];
    if (Array.isArray(out)) {
      return out.map(taskDef => {
         if (typeof taskDef === "string") {
             const fn = registry[taskDef.toUpperCase()];
             if (!fn) {
               throw new Error(`Task "${taskDef}" not found in registry.`);
             }
             // Instantiate a new Task with the task name and function.
             return new Task(taskDef, fn);
         } else if (typeof taskDef === "object" && taskDef.fn) {
             const fn = registry[taskDef.fn.toUpperCase()];
             if (!fn) {
               throw new Error(`Task "${taskDef.fn}" not found in registry.`);
             }
             const options = {};
             if (taskDef.fallbackFn) {
               const fb = registry[taskDef.fallbackFn.toUpperCase()];
               if (!fb) {
                 throw new Error(`Fallback task "${taskDef.fallbackFn}" not found in registry.`);
               }
               options.fallbackFn = fb;
             }
             return new Task(taskDef.fn, fn, options);
         } else {
             // Already instantiated? (unlikely here)
             return taskDef;
         }
      });
    }
    return [];
  };
}

/**
 * Given a job name, a raw job definition, and a tasks registry,
 * returns a new job definition with fully resolved stages.
 */
function buildResolvedJob(jobName, jobDefinition, registry) {
  const resolvedStages = jobDefinition.stages.map((stage, index) => ({
    name: stage.name || `Stage ${index + 1}`,
    // For the main tasks of the stage we do not instantiate here;
    // Job.js instantiates them by doing: new Task(...).
    tasks: stage.tasks.map(task => resolveTask(task, registry)),
    callback: stage.callback,
    mode: stage.mode || "parallel",
    // For conditional mode, wrap the nextTasks function so it returns instantiated Tasks.
    nextTasks: stage.nextTasks ? wrapNextTasks(stage.nextTasks, registry) : null
  }));

  return {
    inputSchema: jobDefinition.inputSchema,
    preprocessor: jobDefinition.preprocessor,
    stages: resolvedStages
  };
}

module.exports = {
  buildTasksRegistry,
  buildResolvedJob
};
