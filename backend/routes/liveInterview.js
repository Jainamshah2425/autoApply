// routes/liveInterview.js
// Express routes for the live AI interview feature.

const express = require('express');
const router = express.Router();
const { startSession, respondToAnswer, endSession } = require('../services/liveInterviewService.js');
const { executeCode, runTestCases } = require('../services/codeExecutionService.js');
const LiveInterviewSession = require('../models/LiveInterviewSession.js');

/**
 * POST /api/live-interview/start
 * Start a new live interview session.
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, jobDescription, mode } = req.body;

    if (!userId)          return res.status(400).json({ error: 'userId is required' });
    if (!jobDescription)  return res.status(400).json({ error: 'jobDescription is required' });
    if (!['behavioral', 'technical', 'coding'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be behavioral, technical, or coding' });
    }

    console.log(`🎙️ Starting live ${mode} interview for user ${userId}`);
    const result = await startSession(userId, jobDescription, mode);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting live interview:', error);
    res.status(500).json({ error: error.message || 'Failed to start interview' });
  }
});

/**
 * POST /api/live-interview/respond
 * Submit an answer and get the AI's follow-up response.
 */
router.post('/respond', async (req, res) => {
  try {
    const { sessionId, answer, codeSubmission } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    if (!answer || answer.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a meaningful answer' });
    }

    console.log(`💬 User responded in session ${sessionId}`);
    const result = await respondToAnswer(sessionId, answer, codeSubmission);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error processing response:', error);
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to process response' });
  }
});

/**
 * POST /api/live-interview/execute-code
 * Execute code using the Piston API.
 */
router.post('/execute-code', async (req, res) => {
  try {
    const { code, language, testCases } = req.body;

    if (!code)     return res.status(400).json({ error: 'code is required' });
    if (!language) return res.status(400).json({ error: 'language is required' });

    console.log(`⚙️ Executing ${language} code (${code.length} chars)`);

    let result;
    if (testCases && testCases.length > 0) {
      result = await runTestCases(code, language, testCases);
    } else {
      const execResult = await executeCode(code, language);
      result = {
        output: execResult.output,
        stderr: execResult.stderr,
        exitCode: execResult.exitCode,
        passed: execResult.exitCode === 0,
        compilationError: execResult.compilationError
      };
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ error: error.message || 'Code execution failed' });
  }
});

/**
 * POST /api/live-interview/end
 * End the session and generate a summary.
 */
router.post('/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    console.log(`🏁 Ending live interview session ${sessionId}`);
    const result = await endSession(sessionId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: error.message || 'Failed to end session' });
  }
});

/**
 * GET /api/live-interview/session/:sessionId
 * Get session details.
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await LiveInterviewSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * GET /api/live-interview/sessions/user/:userId
 * Get all live interview sessions for a user.
 */
router.get('/sessions/user/:userId', async (req, res) => {
  try {
    const sessions = await LiveInterviewSession.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('sessionId mode status metrics startedAt completedAt')
      .limit(20);

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

module.exports = router;
