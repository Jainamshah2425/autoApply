const express = require('express');
const router = express.Router();
const Resume = require('../models/Resume');
const { generateCoverLetter } = require('../services/coverLetter');
const { generateImprovedAnswer } = require('../services/llm');
const { generateResumeReview } = require('../services/resumeReview');
const validate = require('../middleware/validate');
const { groqRateLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

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

const resumeReviewSchema = {
  body: {
    jobTitle: { required: false, type: 'string', maxLength: 200 },
    jobDescription: { required: false, type: 'string', maxLength: 8000 },
  }
};

router.post('/generate-cover-letter', requireAuth, groqRateLimiter, validate(coverLetterSchema), async (req, res, next) => {
  const { jobTitle, companyName, skills } = req.body;
  const userId = req.auth.userId;

  try {
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found for this user' });
    }

    const letter = await generateCoverLetter({ jobTitle, companyName, skills, resumeText: resume.text, userId });
    res.json({ letter });
  } catch (err) {
    next(err);
  }
});

router.post('/generate-improved-answer', requireAuth, groqRateLimiter, validate(improvedAnswerSchema), async (req, res, next) => {
  const { question, userAnswer, jobDescription } = req.body;
  const userId = req.auth.userId;

  try {
    let resumeText = '';
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (resume) {
      resumeText = resume.text;
    }

    const improvedAnswer = await generateImprovedAnswer({
      question,
      userAnswer,
      jobDescription,
      resumeText,
      userId
    });
    
    res.json({ improvedAnswer });
  } catch (err) {
    next(err);
  }
});

router.post('/review-resume', requireAuth, groqRateLimiter, validate(resumeReviewSchema), async (req, res, next) => {
  const { jobTitle = '', jobDescription = '' } = req.body;
  const userId = req.auth.userId;

  try {
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found for this user. Upload a resume first.' });
    }

    const review = await generateResumeReview({
      resumeText: resume.text,
      jobTitle,
      jobDescription,
      userId,
    });

    res.json({ review });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
