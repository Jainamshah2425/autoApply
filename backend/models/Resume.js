const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  pdf: {
    type: Buffer, // Field to store the resume PDF file
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MAX_RESUME_BYTES = 8 * 1024 * 1024; // 8MB — matches the multer upload cap

resumeSchema.pre('validate', function (next) {
  if (this.pdf && this.pdf.length > MAX_RESUME_BYTES) {
    return next(new Error('Resume PDF exceeds maximum allowed size'));
  }
  next();
});

module.exports = mongoose.model('Resume', resumeSchema);
