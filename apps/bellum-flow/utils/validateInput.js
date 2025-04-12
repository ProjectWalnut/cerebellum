function validateInput(input, schema) {
    const { required = [], properties = {} } = schema;
  
    // Ensure input is an object before checking properties
    if (typeof input !== 'object' || input === null) {
      return { valid: false, message: `Expected input to be an object, got '${typeof input}' instead.` };
    }
  
    // Check required keys
    for (const key of required) {
      if (!(key in input)) {
        return { valid: false, message: `'${key}' is required.` };
      }
    }
  
    // Check type of each property
    // Check type of each property
for (const key in properties) {
  if (key in input) {
    const expectedType = properties[key].type;
    const actualValue = input[key];
    const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue;

    if (actualType !== expectedType) {
      return { 
        valid: false, 
        message: `'${key}' should be of type '${expectedType}', got '${actualType}' instead.` 
      };
    }
  }
}
    
    return { valid: true };
  }
  
  module.exports = validateInput;
  