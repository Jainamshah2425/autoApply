// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

// Diagnostic log
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);

const app = express();
app.use(cors());
app.use(express.json());

const llmRoutes = require('./routes/llm.js');
const userRoutes = require('./routes/user.js');
const jobRoutes = require('./routes/jobs.js');
const authRoutes = require('./routes/auth.js');
const emailRoutes = require('./routes/email.js');
const interviewRoutes = require('./routes/interview.js');

app.use('/api/llm', llmRoutes);
app.use('/api/user', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/interview', interviewRoutes);


const { scheduleAutoApply } = require('./cron/dailyApply.js');
scheduleAutoApply();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(5000, () => console.log('🚀 Server running on port 5000'));
  })
  .catch((err) => console.error(err));
