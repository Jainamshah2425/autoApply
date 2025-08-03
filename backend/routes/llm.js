// routes/llm.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Resume = require('../models/Resume');
const { generateCoverLetter } = require('../services/coverLetter');
const { generateImprovedAnswer } = require('../services/llm');

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

router.post('/generate-improved-answer', async (req, res) => {
  const { question, userAnswer, jobDescription, userId } = req.body;

  try {
    // Optional: Fetch user's resume for context
    let resumeText = '';
    if (userId) {
      const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
      if (resume) {
        resumeText = resume.text;
      }
    }

    const improvedAnswer = await generateImprovedAnswer({
      question,
      userAnswer,
      jobDescription,
      resumeText
    });
    
    res.json({ improvedAnswer });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to generate improved answer' });
  }
});

module.exports = router;


module.exports = router;

