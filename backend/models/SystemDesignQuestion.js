const mongoose = require('mongoose');

const systemDesignQuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  prompt: { type: String, required: true },
  functionalRequirements: { type: [String], default: [] },
  nonFunctionalRequirements: { type: [String], default: [] },
  keyTopics: { type: [String], default: [], index: true },
  referenceApproach: { type: [String], default: [] },
  estimatedMinutes: { type: Number, default: 45 },
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemDesignQuestion', systemDesignQuestionSchema);
