const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: err.message,
      details: err.details 
    });
  }
  
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ 
      error: 'Invalid ID', 
      message: 'Provided ID is not valid' 
    });
  }
  
  if (err.code === 11000) {
    return res.status(409).json({ 
      error: 'Duplicate Entry', 
      message: 'Resource already exists' 
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
