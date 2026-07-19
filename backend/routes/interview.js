const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  generateQuestions,
  analyzeAnswer,
  completeSession
} = require('../services/interviewService');
const pdf = require('pdf-parse');
const { requireAuth, requireOwnUserId } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(requireAuth);

router.post('/generate-questions', upload.single('jobDescriptionFile'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const userId = req.auth.userId;
    let description = jobDescription;

    if (req.file) {
      const data = await pdf(req.file.buffer);
      description = data.text;
    }

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Job description is required and must be a string' });
    }

    const result = await generateQuestions(description.trim(), userId);

    if (!result?.questions?.length) {
      return res.status(500).json({ error: 'Failed to generate questions' });
    }

    res.status(200).json({
      success: true,
      questions: result.questions,
      sessionId: result.sessionId,
      persisted: result.persisted !== undefined ? result.persisted : true,
      questionCount: result.questions.length
    });
  } catch (error) {
    console.error('Error in /generate-questions:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/analyze-answer', async (req, res) => {
  try {
    const { question, answer, audioMetrics, sessionId, questionIndex } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    if (answer.trim().length < 10) {
      return res.status(400).json({ error: 'Answer must be at least 10 characters long' });
    }

    const analysis = await analyzeAnswer(
      question,
      answer,
      audioMetrics,
      sessionId,
      questionIndex
    );

    res.json({
      success: true,
      ...analysis,
      message: 'Answer analyzed successfully'
    });
  } catch (error) {
    console.error('Error in /analyze-answer:', error);
    res.status(500).json({
      error: 'Failed to analyze answer',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.post('/complete-session', async (req, res) => {
  try {
    const { sessionId, questionTimings } = req.body;
    const userId = req.auth.userId;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const result = await completeSession(sessionId, userId, questionTimings);

    let heatmapUpdateResult = null;
    try {
      const HeatmapService = require('../services/heatmapService');
      const activityDetails = {
        description: `Completed mock interview session (${result.insights?.metrics?.totalQuestions || 0} questions)`,
        metadata: {
          sessionId,
          questionsAnswered: result.insights?.metrics?.completedQuestions || 0,
          totalQuestions: result.insights?.metrics?.totalQuestions || 0,
          averageScore: result.insights?.metrics?.averageScore || 0,
          duration: result.insights?.metrics?.totalDuration || 0,
          completionRate: result.insights?.metrics?.completionRate || 0
        }
      };
      heatmapUpdateResult = await HeatmapService.addActivity(userId, 'interview_completed', activityDetails);
    } catch (trackingError) {
      console.error('Heatmap tracking failed:', trackingError);
      heatmapUpdateResult = { success: false, error: trackingError.message };
    }

    res.json({
      success: true,
      insights: result.insights,
      message: 'Session completed successfully',
      heatmapUpdate: heatmapUpdateResult || { success: false, message: 'Heatmap update failed but session completed' }
    });
  } catch (error) {
    console.error('Error in /complete-session:', error);
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: 'Interview session not found' });
    }
    res.status(500).json({
      error: 'Failed to complete session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const InterviewSession = require('../models/InterviewSession');
    const session = await InterviewSession.findOne({ sessionId: req.params.sessionId })
      .populate('user', 'name email profilePicture currentTitle company');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user._id.toString() !== req.auth.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ success: true, session, message: 'Session retrieved successfully' });
  } catch (error) {
    console.error('Error in /session/:sessionId:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/sessions/user/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const InterviewSession = require('../models/InterviewSession');

    const query = { user: userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [sessions, total] = await Promise.all([
      InterviewSession.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('sessionId jobDescription questions responses sessionMetrics status insights createdAt completedAt'),
      InterviewSession.countDocuments(query)
    ]);

    res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Sessions retrieved successfully'
    });
  } catch (error) {
    console.error('Error in /sessions/user/:userId:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const InterviewSession = require('../models/InterviewSession');

    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user.toString() !== req.auth.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this session' });
    }

    await InterviewSession.deleteOne({ sessionId });
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /session/:sessionId:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/stats/user/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const InterviewSession = require('../models/InterviewSession');
    const mongoose = require('mongoose');

    const stats = await InterviewSession.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.params.userId) } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageScore: { $avg: '$sessionMetrics.averageScore' },
          totalQuestions: { $sum: { $size: '$questions' } },
          totalResponses: { $sum: { $size: '$responses' } }
        }
      }
    ]);

    const userStats = stats[0] || {
      totalSessions: 0,
      completedSessions: 0,
      averageScore: 0,
      totalQuestions: 0,
      totalResponses: 0
    };

    userStats.completionRate = userStats.totalSessions > 0
      ? (userStats.completedSessions / userStats.totalSessions) * 100
      : 0;

    res.json({ success: true, stats: userStats, message: 'Statistics retrieved successfully' });
  } catch (error) {
    console.error('Error in /stats/user/:userId:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.use((error, req, res, next) => {
  console.error('Interview route error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum 10MB allowed.' });
    }
    return res.status(400).json({ error: 'File upload error', details: error.message });
  }

  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
