// routes/systemDesign.js
const express = require('express');
const router = express.Router();
const {
  listQuestions,
  getQuestion,
  evaluateSubmission,
} = require('../services/systemDesignService.js');
const SystemDesignAttempt = require('../models/SystemDesignAttempt.js');
const { requireAuth, requireOwnUserId } = require('../middleware/auth');
const { groqRateLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/system-design/questions
 * List topic metadata (no prompt/reference spoilers).
 */
router.get('/questions', async (req, res) => {
  try {
    const questions = await listQuestions();
    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error fetching system design questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * GET /api/system-design/questions/:slug
 * Full prompt + requirement hints for practicing.
 */
router.get('/questions/:slug', async (req, res) => {
  try {
    const question = await getQuestion(req.params.slug);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true, question });
  } catch (error) {
    console.error('Error fetching system design question:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

// Everything below requires a verified bearer token.
router.use(requireAuth);

/**
 * POST /api/system-design/submit
 * Grade a written design answer via Groq and persist the attempt.
 */
router.post('/submit', groqRateLimiter, async (req, res) => {
  try {
    const { questionId, answerText, timeSpentSeconds } = req.body;
    if (!questionId) return res.status(400).json({ error: 'questionId is required' });

    const result = await evaluateSubmission({
      userId: req.auth.userId,
      questionId,
      answerText,
      timeSpentSeconds,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error evaluating system design submission:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to evaluate submission' });
  }
});

/**
 * GET /api/system-design/attempt/:attemptId
 * Get attempt details (feedback) for review.
 */
router.get('/attempt/:attemptId', async (req, res) => {
  try {
    const attempt = await SystemDesignAttempt.findById(req.params.attemptId)
      .populate('questionId', 'title slug difficulty referenceApproach');
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.userId.toString() !== req.auth.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ success: true, attempt });
  } catch (error) {
    console.error('Error fetching attempt:', error);
    res.status(500).json({ error: 'Failed to fetch attempt' });
  }
});

/**
 * GET /api/system-design/history/:userId
 * Get attempt history for a user.
 */
router.get('/history/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const history = await SystemDesignAttempt.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('questionId', 'title slug difficulty')
      .select('questionId feedback.overallScore timeSpentSeconds status completedAt createdAt');

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
