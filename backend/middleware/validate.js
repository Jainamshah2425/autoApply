const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }
    
    if (schema.params) {
      const paramErrors = validateObject(req.params, schema.params, 'params');
      errors.push(...paramErrors);
    }
    
    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }
    
    if (errors.length > 0) {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.details = errors;
      return next(err);
    }
    
    next();
  };
};

const validateObject = (data, rules, source) => {
  const errors = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: `${source}.${field}`, message: `${field} is required` });
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push({ field: `${source}.${field}`, message: `${field} must be a string` });
      }
      
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push({ field: `${source}.${field}`, message: `${field} must be a number` });
      }
      
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push({ field: `${source}.${field}`, message: `${field} must be an array` });
      }
      
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({ field: `${source}.${field}`, message: `${field} must be at least ${rule.minLength} characters` });
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field: `${source}.${field}`, message: `${field} must be at most ${rule.maxLength} characters` });
      }
      
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field: `${source}.${field}`, message: `${field} must be one of: ${rule.enum.join(', ')}` });
      }
    }
  }
  
  return errors;
};

module.exports = validate;
