// index.js
const dns = require('dns');
// Some ISPs fail SRV lookups for mongodb+srv — use public DNS resolvers
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');
const validate = require('./middleware/validate');

dotenv.config();

console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'configured' : 'not set');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not set');

const app = express();
app.set('trust proxy', 1);

// Add basic health check endpoint
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[dbState] || 'unknown';
  res.json({ 
    status: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    database: dbStatus,
  });
});

const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://auto-apply-seven.vercel.app'
];

app.use(cors({
  origin: corsOrigins,
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
const liveInterviewRoutes = require('./routes/liveInterview.js');
const aptitudeRoutes = require('./routes/aptitude.js');

app.use('/api/llm', llmRoutes);
app.use('/api/user', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/live-interview', liveInterviewRoutes);
app.use('/api/aptitude', aptitudeRoutes);


const { scheduleAutoApply } = require('./cron/dailyApply.js');
const { scheduleAptitudeRefresh } = require('./cron/refreshAptitudeQuestions.js');
const { scheduleKeepAlive } = require('./cron/keepAlive.js');

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server even if MongoDB connection fails (for debugging)
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);

  // Start keep-alive cron immediately (no DB dependency)
  scheduleKeepAlive();
});

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .then(async () => {
      console.log('✅ MongoDB connected');
      console.log('   Database:', mongoose.connection.db?.databaseName || '(default)');
      try {
        const AptitudeQuestion = require('./models/AptitudeQuestion');
        const aptitudeCount = await AptitudeQuestion.countDocuments();
        if (aptitudeCount === 0) {
          console.log('📚 Aptitude bank empty — seeding questions...');
          const { execSync } = require('child_process');
          const path = require('path');
          execSync('node scripts/seedAptitudeIfEmpty.js', {
            cwd: path.join(__dirname),
            stdio: 'inherit',
          });
        }
      } catch (seedErr) {
        console.warn('⚠️  Aptitude seed skipped:', seedErr.message);
      }
      scheduleAutoApply();
      scheduleAptitudeRefresh();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection failed:', err.message);
      console.log('⚠️  Server running without database connection');
      console.log('   Run: npm run test:db   to diagnose');
    });
} else {
  console.log('⚠️  MONGODB_URI not configured - skipping database connection');
}
