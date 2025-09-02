// models/ApplicationLog.js
const mongoose = require('mongoose');

const ApplicationLogSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  jobId: mongoose.Schema.Types.ObjectId,
  status: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ApplicationLog', ApplicationLogSchema);
