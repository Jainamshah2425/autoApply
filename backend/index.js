// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Diagnostic logs
console.log('🔧 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'configured' : 'not set');
console.log('- FASTAPI_URL:', process.env.FASTAPI_URL || 'not set');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not set');

const app = express();

// Add basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-url.vercel.app'],
  credentials: true
}));
app.use(express.json());

const llmRoutes = require('./routes/llm.js');
const userRoutes = require('./routes/user.js');
const jobRoutes = require('./routes/jobs.js');
const authRoutes = require('./routes/auth.js');
const emailRoutes = require('./routes/email.js');
const interviewRoutes = require('./routes/interview.js');
const profileRoutes = require('./routes/profile.js');

app.use('/api/llm', llmRoutes);
app.use('/api/user', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/profile', profileRoutes);


const { scheduleAutoApply } = require('./cron/dailyApply.js');

const PORT = process.env.PORT || 5000;

// Start server even if MongoDB connection fails (for debugging)
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      // Only schedule auto-apply after MongoDB is connected
      scheduleAutoApply();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection failed:', err.message);
      console.log('⚠️  Server running without database connection');
    });
} else {
  console.log('⚠️  MONGODB_URI not configured - skipping database connection');
}
