// routes/llm.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Resume = require('../models/Resume');
const { generateCoverLetter } = require('../services/coverLetter');

router.post('/generate-cover-letter', async (req, res) => {
  const { jobTitle, companyName, skills, userId } = req.body;

  try {
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found for this user' });
    }

    const letter = await generateCoverLetter({ jobTitle, companyName, skills, resumeText: resume.text });
    res.json({ letter });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to generate cover letter' });
  }
});


module.exports = router;

