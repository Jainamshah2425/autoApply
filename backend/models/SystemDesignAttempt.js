const mongoose = require('mongoose');

const systemDesignAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemDesignQuestion',
    required: true
  },
  answerText: { type: String, required: true },
  timeSpentSeconds: { type: Number, default: 0 },

  feedback: {
    overallScore: Number,
    summary: String,
    strengths: [String],
    gaps: [String],
    requirementsCoverage: String,
    scalabilityNotes: String,
    communicationNotes: String,
  },

  status: {
    type: String,
    enum: ['in-progress', 'completed'],
    default: 'completed'
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemDesignAttempt', systemDesignAttemptSchema);
