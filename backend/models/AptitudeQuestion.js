const mongoose = require('mongoose');

const aptitudeQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: [arr => arr.length >= 2 && arr.length <= 6, 'Must have 2-6 options']
  },
  correctAnswer: { type: Number, required: true }, // index of correct option
  explanation: { type: String, required: true },
  shortcutMethod: String, // optional shortcut/trick
  topic: {
    type: String,
    required: true,
    index: true
    // e.g. percentages, profit-loss, time-work, probability, syllogisms, etc.
  },
  category: {
    type: String,
    required: true,
    enum: ['quantitative', 'logical', 'verbal'],
    index: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  companyTags: [String], // e.g. ['TCS', 'Infosys', 'Wipro']
  averageTimeSeconds: { type: Number, default: 60 },
  timesAttempted: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
}, {
  timestamps: true
});

// Virtual: success rate
aptitudeQuestionSchema.virtual('successRate').get(function () {
  return this.timesAttempted > 0 ? this.timesCorrect / this.timesAttempted : 0;
});

aptitudeQuestionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('AptitudeQuestion', aptitudeQuestionSchema);
