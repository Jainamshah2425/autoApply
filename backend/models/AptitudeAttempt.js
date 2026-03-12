const mongoose = require('mongoose');

const aptitudeAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  testType: {
    type: String,
    enum: ['practice', 'timed', 'topic-wise'],
    default: 'practice'
  },
  category: String, // quantitative, logical, verbal, mixed
  topics: [String], // topics covered in this attempt

  questions: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AptitudeQuestion' },
    selectedAnswer: Number, // index of selected option
    isCorrect: Boolean,
    timeSpentSeconds: Number,
    skipped: Boolean
  }],

  // Test-level metrics
  score: { type: Number, default: 0 },          // raw score (correct answers)
  totalQuestions: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  totalTimeSeconds: { type: Number, default: 0 },
  averageTimePerQuestion: { type: Number, default: 0 },

  // Topic-wise breakdown
  topicBreakdown: [{
    topic: String,
    correct: Number,
    total: Number,
    percentage: Number
  }],

  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },
  timeLimitMinutes: Number, // null for practice mode
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('AptitudeAttempt', aptitudeAttemptSchema);
