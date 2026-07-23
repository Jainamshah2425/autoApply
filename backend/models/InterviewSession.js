const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: { // Add direct userId reference
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  topic: String, // Add topic field for favorite topics tracking
  overallScore: Number, // Add overall score for statistics
  questions: [{
    type: String  // Changed from embedded document to String
  }],
  responses: [{
    questionIndex: Number,
    question: String,
    answer: String,
    audioMetrics: {
      duration: Number,
      wordsPerMinute: Number,
      wordCount: Number
    },
    analysis: Object,
    videoAnalysis: Object, // To store results from Python analysis
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
    timestamp: Date
  }],
  sessionMetrics: {
    totalDuration: Number,
    averageScore: Number,
    completionRate: Number
  },
  analysisMetrics: [{
    questionIndex: Number,
    timestamp: Date,
    videoSize: Number,
    processingTime: Number,
    transcriptionLength: Number,
    success: Boolean,
    error: String,
    errorDetails: String
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  insights: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Set once completion's activity has been recorded in the user's heatmap,
  // so a retry after a partial failure doesn't double-count the activity.
  heatmapRecorded: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
