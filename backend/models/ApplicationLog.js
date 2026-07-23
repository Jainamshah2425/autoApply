// models/ApplicationLog.js
//
// UNUSED as of 2026-07-23 — zero requires of this model anywhere in the
// codebase. Distinct from the actively-used `Application` model
// (models/Application.js), which is what routes/user.js, services/jobService.js,
// and scripts/seedApplications.js actually read/write. Kept for reference,
// not indexed or otherwise touched.
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
