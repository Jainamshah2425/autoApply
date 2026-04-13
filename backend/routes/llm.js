const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Resume = require('../models/Resume');
const { generateCoverLetter } = require('../services/coverLetter');
const { generateImprovedAnswer } = require('../services/llm');
const validate = require('../middleware/validate');

const coverLetterSchema = {
  body: {
    jobTitle: { required: true, type: 'string', minLength: 1 },
    companyName: { required: true, type: 'string', minLength: 1 },
    userId: { required: true, type: 'string' }
  }
};

const improvedAnswerSchema = {
  body: {
    question: { required: true, type: 'string', minLength: 1 },
    userAnswer: { required: true, type: 'string', minLength: 1 }
  }
};

router.post('/generate-cover-letter', validate(coverLetterSchema), async (req, res, next) => {
  const { jobTitle, companyName, skills, userId } = req.body;

  try {
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found for this user' });
    }

    const letter = await generateCoverLetter({ jobTitle, companyName, skills, resumeText: resume.text });
    res.json({ letter });
  } catch (err) {
    next(err);
  }
});

router.post('/generate-improved-answer', validate(improvedAnswerSchema), async (req, res, next) => {
  const { question, userAnswer, jobDescription, userId } = req.body;

  try {
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
    next(err);
  }
});

module.exports = router;
