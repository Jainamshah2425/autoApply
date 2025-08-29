const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  userId: { // Add direct userId reference for faster queries
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  interviewSession: { 
    type: String, 
    required: true 
  },
  questionIndex: { 
    type: Number, 
    required: true 
  },
  filePath: { 
    type: String, 
    required: false // Make optional since we might not always store the file
  },
  fileSize: { 
    type: Number, 
    required: false // Make optional
  },
  originalName: {
    type: String,
    required: false // Original filename when uploaded
  },
  duration: { 
    type: Number,
    default: 0
  }, // in seconds
  transcription: {
    type: String,
    default: ''
  },
  videoMetrics: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  analysisId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'processed', 'error'],
    default: 'uploaded'
  },
  transcript: {
    type: String,
    default: ''
  },
  analysis: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  errorMessage: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Video', VideoSchema);
