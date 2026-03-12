const mongoose = require('mongoose');

const liveInterviewSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mode: {
    type: String,
    enum: ['behavioral', 'technical', 'coding'],
    required: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  resumeContext: String,

  // Full conversation history for context continuity
  conversationHistory: [{
    role: { type: String, enum: ['system', 'assistant', 'user'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],

  // Structured per-question tracking
  questions: [{
    questionText: String,
    questionType: { type: String, enum: ['behavioral', 'technical', 'coding', 'follow-up'] },
    userAnswer: String,
    aiFollowUp: String,
    score: Number,
    feedback: String,
    // For coding questions
    codeSubmission: {
      code: String,
      language: String,
      executionOutput: String,
      passed: Boolean,
      testResults: [{
        input: String,
        expected: String,
        actual: String,
        passed: Boolean
      }]
    },
    timeSpentSeconds: Number,
    timestamp: { type: Date, default: Date.now }
  }],

  // Session-level metrics
  metrics: {
    totalQuestions: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
    overallFeedback: String,
    strengths: [String],
    improvements: [String],
    categoryScores: {
      communication: Number,
      technical: Number,
      problemSolving: Number,
      confidence: Number
    }
  },

  status: {
    type: String,
    enum: ['active', 'completed', 'interrupted'],
    default: 'active'
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('LiveInterviewSession', liveInterviewSessionSchema);
