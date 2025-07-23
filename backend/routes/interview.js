const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  generateQuestions, 
  analyzeAnswer, 
  transcribeAudio, 
  completeSession 
} = require('../services/interviewService');
const pdf = require('pdf-parse');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const Bull = require('bull');
const fs = require('fs');
const path = require('path');

// Create a queue for video processing
const videoQueue = new Bull('video-processing', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Configure multer for video file uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/videos');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

/**
 * POST /api/interview/upload-video
 * Upload a video answer to a question
 */
router.post('/upload-video', videoUpload.single('video'), async (req, res) => {
  try {
    const { userId, sessionId, questionIndex, duration } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    // Save video metadata to the database
    const Video = require('../models/Video');
    const newVideo = new Video({
      user: userId,
      interviewSession: sessionId,
      questionIndex,
      filePath: req.file.path,
      fileSize: req.file.size,
      duration,
    });
    await newVideo.save();

    // Add video to the processing queue
    await videoQueue.add({ videoId: newVideo._id });

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      videoId: newVideo._id,
    });
  } catch (error) {
    console.error('Error in /upload-video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});


/**
 * POST /api/interview/generate-questions
 * Generate interview questions based on job description and user's resume
 */
router.post('/generate-questions', upload.single('jobDescriptionFile'), async (req, res) => {
  console.log('=== API ROUTE: /generate-questions ===');
  
  try {
    const { jobDescription, userId } = req.body;
    let description = jobDescription;

    if (req.file) {
      const data = await pdf(req.file.buffer);
      description = data.text;
    }
    
    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        error: 'Job description is required and must be a string',
      });
    }
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'User ID is required and must be a string',
      });
    }
    
    const result = await generateQuestions(description.trim(), userId);
    
    if (!result || !result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
      return res.status(500).json({
        error: 'Failed to generate questions',
      });
    }
    
    const response = {
      success: true,
      questions: result.questions,
      sessionId: result.sessionId,
      questionCount: result.questions.length
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('=== API ROUTE ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/interview/analyze-answer
 * Analyze user's answer to an interview question
 */
router.post('/analyze-answer', async (req, res) => {
  try {
    const { question, answer, audioMetrics, sessionId, questionIndex } = req.body;

    // Validation
    if (!question || !answer) {
      return res.status(400).json({ 
        error: 'Question and answer are required' 
      });
    }

    if (answer.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Answer must be at least 10 characters long' 
      });
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/interview/transcribe
 * Transcribe audio recording to text
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Audio file is required' 
      });
    }

    const duration = parseFloat(req.body.duration) || 0;
    
    // Validate audio duration (should be reasonable)
    if (duration > 300) { // 5 minutes max
      return res.status(400).json({ 
        error: 'Audio recording too long. Maximum 5 minutes allowed.' 
      });
    }

    const audioBuffer = req.file.buffer;
    const transcription = await transcribeAudio(audioBuffer);
    
    // Calculate basic metrics
    const wordCount = transcription.split(' ').filter(word => word.length > 0).length;
    const wordsPerMinute = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;
    
    res.json({
      success: true,
      transcription,
      audioMetrics: {
        duration,
        wordCount,
        wordsPerMinute,
        fileSize: req.file.size
      },
      message: 'Audio transcribed successfully'
    });

  } catch (error) {
    console.error('Error in /transcribe:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Audio file too large. Maximum 10MB allowed.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/interview/complete-session
 * Complete interview session and generate comprehensive insights
 */
router.post('/complete-session', async (req, res) => {
  try {
    const { sessionId, userId, questionTimings } = req.body;

    // Validation
    if (!sessionId || !userId) {
      return res.status(400).json({ 
        error: 'Session ID and user ID are required' 
      });
    }

    const result = await completeSession(sessionId, userId, questionTimings);
    
    res.json({
      success: true,
      insights: result.insights,
      message: 'Session completed successfully'
    });

  } catch (error) {
    console.error('Error in /complete-session:', error);
    
    if (error.message === 'Session not found') {
      return res.status(404).json({ 
        error: 'Interview session not found' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to complete session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/interview/session/:sessionId
 * Get interview session details
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const InterviewSession = require('../models/InterviewSession');
    const session = await InterviewSession.findOne({ sessionId }).populate('user');
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    res.json({
      success: true,
      session,
      message: 'Session retrieved successfully'
    });

  } catch (error) {
    console.error('Error in /session/:sessionId:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/interview/sessions/user/:userId
 * Get all interview sessions for a user
 */
router.get('/sessions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    const InterviewSession = require('../models/InterviewSession');
    
    // Build query
    const query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [sessions, total] = await Promise.all([
      InterviewSession.find(find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('sessionId jobDescription questions responses sessionMetrics status createdAt completedAt'),
      InterviewSession.countDocuments(query)
)]);
    
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

/**
 * DELETE /api/interview/session/:sessionId
 * Delete an interview session
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body; // For authorization
    
    const InterviewSession = require('../models/InterviewSession');
    
    // Find and verify ownership
    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }
    
    if (session.user.toString() !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized to delete this session' 
      });
    }
    
    await InterviewSession.deleteOne({ sessionId });
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /session/:sessionId:', error);
    res.status(500).json({ 
      error: 'Failed to delete session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/interview/stats/user/:userId
 * Get user's interview statistics
 */
router.get('/stats/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const InterviewSession = require('../models/InterviewSession');
    
    const stats = await InterviewSession.aggregate([
      { $match: { user: require('mongoose').Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
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
    
    // Calculate completion rate
    userStats.completionRate = userStats.totalSessions > 0 
      ? (userStats.completedSessions / userStats.totalSessions) * 100 
      : 0;
    
    res.json({
      success: true,
      stats: userStats,
      message: 'Statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error in /stats/user/:userId:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Interview route error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum 10MB allowed.' 
      });
    }
    return res.status(400).json({ 
      error: 'File upload error',
      details: error.message 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;