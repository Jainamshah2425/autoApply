const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  generateQuestions, 
  analyzeAnswer, 
  transcribeAudio, 
  completeSession 
} = require('../services/interviewService');
const fastApiClient = require('../services/fastApiClient');
const path = require('path');
const fs = require('fs');
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
    const User = require('../models/User');
    const mongoose = require('mongoose');
    
    // Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        error: 'Invalid userId format. Must be a valid MongoDB ObjectId.' 
      });
    }
    
    const newVideo = new Video({
      userId: new mongoose.Types.ObjectId(userId),
      user: new mongoose.Types.ObjectId(userId),
      interviewSession: sessionId,
      questionIndex,
      filePath: req.file.path,
      fileSize: req.file.size,
      duration,
    });
    await newVideo.save();

    // Track activity in user's contribution heatmap using HeatmapService
    try {
      const HeatmapService = require('../services/heatmapService');
      
      const activityDetails = {
        description: `Uploaded video for question ${parseInt(questionIndex) + 1}`,
        metadata: {
          questionIndex: questionIndex,
          duration: duration,
          videoId: newVideo._id.toString(),
          sessionId: sessionId
        }
      };

      await HeatmapService.addActivity(userId, 'video_upload', activityDetails);
    } catch (trackingError) {
      console.warn('Activity tracking failed:', trackingError);
      // Don't fail the video upload if tracking fails
    }

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
      persisted: result.persisted !== undefined ? result.persisted : true,
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
    console.log('=== ANALYZE ANSWER ENDPOINT ===');
    console.log('Request body:', {
      question: req.body.question?.substring(0, 100) + '...',
      answer: req.body.answer?.substring(0, 100) + '...',
      audioMetrics: req.body.audioMetrics,
      sessionId: req.body.sessionId,
      questionIndex: req.body.questionIndex
    });

    const { question, answer, audioMetrics, sessionId, questionIndex } = req.body;

    // Validation
    if (!question || !answer) {
      console.error('Validation failed: Missing question or answer');
      return res.status(400).json({ 
        error: 'Question and answer are required' 
      });
    }

    if (answer.trim().length < 10) {
      console.error('Validation failed: Answer too short');
      return res.status(400).json({ 
        error: 'Answer must be at least 10 characters long' 
      });
    }

    console.log('Calling analyzeAnswer service...');
    const analysis = await analyzeAnswer(
      question, 
      answer, 
      audioMetrics, 
      sessionId, 
      questionIndex
    );
    
    console.log('Analysis completed successfully');
    res.json({
      success: true,
      ...analysis,
      message: 'Answer analyzed successfully'
    });

  } catch (error) {
    console.error('Error in /analyze-answer:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to analyze answer',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    console.log('=== COMPLETE SESSION DEBUG ===');
    console.log('Received sessionId:', sessionId);
    console.log('Received userId:', userId);
    console.log('SessionId type:', typeof sessionId);

    // Validation
    if (!sessionId || !userId) {
      return res.status(400).json({ 
        error: 'Session ID and user ID are required' 
      });
    }

    const result = await completeSession(sessionId, userId, questionTimings);

    // Enhanced heatmap tracking using HeatmapService
    let heatmapUpdateResult = null;
    try {
      const HeatmapService = require('../services/heatmapService');
      
      // Prepare activity details for heatmap
      const activityDetails = {
        description: `Completed mock interview session (${result.insights?.metrics?.totalQuestions || 0} questions)`,
        metadata: {
          sessionId: sessionId,
          questionsAnswered: result.insights?.metrics?.completedQuestions || 0,
          totalQuestions: result.insights?.metrics?.totalQuestions || 0,
          averageScore: result.insights?.metrics?.averageScore || 0,
          duration: result.insights?.metrics?.totalDuration || 0,
          completionRate: result.insights?.metrics?.completionRate || 0
        },
        questionsAnswered: result.insights?.metrics?.completedQuestions || 0,
        averageScore: result.insights?.metrics?.averageScore || 0,
        completionRate: result.insights?.metrics?.completionRate || 0
      };

      heatmapUpdateResult = await HeatmapService.addActivity(userId, 'interview_completed', activityDetails);
      console.log(`✅ Heatmap updated for user ${userId} - Interview completed`);
      
    } catch (trackingError) {
      console.error('❌ Heatmap tracking failed:', trackingError);
      // Don't fail the session completion if tracking fails
      heatmapUpdateResult = { success: false, error: trackingError.message };
    }
    
    res.json({
      success: true,
      insights: result.insights,
      message: 'Session completed successfully',
      heatmapUpdate: heatmapUpdateResult || {
        success: false,
        message: 'Heatmap update failed but session completed'
      }
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
      InterviewSession.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('sessionId jobDescription questions responses sessionMetrics status createdAt completedAt'),
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
    const mongoose = require('mongoose');
    
    const stats = await InterviewSession.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
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

// Analyze video for transcription
router.post('/analyze-video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    console.log(`Processing video file: ${req.file.path}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Verify the file exists
    if (!fs.existsSync(req.file.path)) {
      return res.status(400).json({ error: 'Video file not found after upload' });
    }

    // Send the video to FastAPI for transcription and analysis
    const result = await fastApiClient.analyzeVideo(req.file.path);
    
    // Calculate video metrics
    const stats = fs.statSync(req.file.path);
    const videoMetrics = {
      fileSize: stats.size,
      duration: result.duration || 0,
      format: 'webm',
      uploadTime: new Date().toISOString()
    };
    
    // Clean up the uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup video file:', cleanupError.message);
    }
    
    // Return the transcription results in the format expected by frontend
    res.json({
      success: true,
      transcription: result.transcription || result.transcript || '',
      video_metrics: videoMetrics,
      request_id: result.request_id,
      confidence: result.confidence
    });
  } catch (error) {
    console.error('Error analyzing video:', error);
    
    // Clean up the uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup video file on error:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze video', 
      details: error.message 
    });
  }
});

module.exports = router;