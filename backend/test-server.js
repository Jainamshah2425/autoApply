const express = require('express');
const cors = require('cors');

// Create a minimal Express app for testing
const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-url.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Simple health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || 'not set',
      MONGODB_URI: process.env.MONGODB_URI ? 'configured' : 'not set',
      FASTAPI_URL: process.env.FASTAPI_URL || 'not set'
    }
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Interview endpoints for testing
app.post('/api/interview/test', (req, res) => {
  res.json({ message: 'Interview endpoint is working!' });
});

app.get('/api/interview/analyze-video', (req, res) => {
  res.status(405).json({ error: 'Method not allowed. Use POST.' });
});

app.post('/api/interview/analyze-video', (req, res) => {
  res.json({ 
    message: 'Video analysis endpoint reached',
    contentType: req.headers['content-type'],
    hasFile: !!req.file,
    bodyKeys: Object.keys(req.body)
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log('Environment check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'configured' : 'not set');
  console.log('- FASTAPI_URL:', process.env.FASTAPI_URL || 'not set');
});

module.exports = app;
