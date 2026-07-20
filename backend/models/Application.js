// models/Application.js
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  title: String,
  company: String,
  url: String,
  appliedAt: { type: Date, default: Date.now },
});

// One application record per user per job — also makes re-clicking "Apply" idempotent.
ApplicationSchema.index({ user: 1, job: 1 }, { unique: true });
// Backs the "my applications" history query (sorted, per-user) without a collection scan.
ApplicationSchema.index({ user: 1, appliedAt: -1 });

module.exports = mongoose.model('Application', ApplicationSchema);
