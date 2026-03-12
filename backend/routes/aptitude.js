// routes/aptitude.js
const express = require('express');
const router = express.Router();
const { generateTest, submitTest, getUserAnalytics, getTopics } = require('../services/aptitudeService.js');
const AptitudeQuestion = require('../models/AptitudeQuestion.js');
const AptitudeAttempt = require('../models/AptitudeAttempt.js');

/**
 * GET /api/aptitude/topics
 * Get available topics with question counts.
 */
router.get('/topics', async (req, res) => {
  try {
    const topics = await getTopics();
    res.json({ success: true, topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

/**
 * POST /api/aptitude/generate-test
 * Generate a test based on preferences.
 */
router.post('/generate-test', async (req, res) => {
  try {
    const { userId, category, topic, difficulty, questionCount, testType, timeLimitMinutes } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const test = await generateTest(userId, {
      category, topic, difficulty,
      questionCount: questionCount || 20,
      testType: testType || 'practice',
      timeLimitMinutes
    });

    res.json({ success: true, ...test });
  } catch (error) {
    console.error('Error generating test:', error);
    res.status(500).json({ error: error.message || 'Failed to generate test' });
  }
});

/**
 * POST /api/aptitude/submit
 * Submit test answers and get results.
 */
router.post('/submit', async (req, res) => {
  try {
    const { attemptId, answers } = req.body;
    if (!attemptId) return res.status(400).json({ error: 'attemptId is required' });
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    const results = await submitTest(attemptId, answers);
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Error submitting test:', error);
    res.status(500).json({ error: error.message || 'Failed to submit test' });
  }
});

/**
 * GET /api/aptitude/analytics/:userId
 * Get user analytics.
 */
router.get('/analytics/:userId', async (req, res) => {
  try {
    const analytics = await getUserAnalytics(req.params.userId);
    res.json({ success: true, ...analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/aptitude/attempt/:attemptId
 * Get attempt details for review.
 */
router.get('/attempt/:attemptId', async (req, res) => {
  try {
    const attempt = await AptitudeAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    // Fetch question details for review (only if completed)
    if (attempt.status === 'completed') {
      const questionIds = attempt.questions.map(q => q.questionId);
      const questions = await AptitudeQuestion.find({ _id: { $in: questionIds } });
      const questionMap = {};
      questions.forEach(q => { questionMap[q._id.toString()] = q; });

      const reviewData = attempt.questions.map(q => {
        const question = questionMap[q.questionId.toString()];
        return {
          questionText: question?.questionText,
          options: question?.options,
          correctAnswer: question?.correctAnswer,
          selectedAnswer: q.selectedAnswer,
          isCorrect: q.isCorrect,
          explanation: question?.explanation,
          shortcutMethod: question?.shortcutMethod,
          topic: question?.topic,
          difficulty: question?.difficulty
        };
      });

      return res.json({ success: true, attempt, reviewData });
    }

    res.json({ success: true, attempt });
  } catch (error) {
    console.error('Error fetching attempt:', error);
    res.status(500).json({ error: 'Failed to fetch attempt' });
  }
});

/**
 * GET /api/aptitude/history/:userId
 * Get test history for a user.
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const history = await AptitudeAttempt.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('testType category score totalQuestions percentage totalTimeSeconds status completedAt');

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/aptitude/question-count
 * Get total question count.
 */
router.get('/question-count', async (req, res) => {
  try {
    const count = await AptitudeQuestion.countDocuments();
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count questions' });
  }
});

module.exports = router;
