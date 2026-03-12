// services/liveInterviewService.js
// Core orchestration for the live AI interview — manages conversation state,
// generates follow-ups, and produces session summaries.

const { v4: uuidv4 } = require('uuid');
const { getLLMResponse } = require('./llm.js');
const LiveInterviewSession = require('../models/LiveInterviewSession.js');
const Resume = require('../models/Resume.js');

// ─── System Prompts ───────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  behavioral: (jd, resume) => `You are a senior HR interviewer conducting a live mock interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:
- Ask ONE question at a time
- Start with an introduction, then move through behavioral questions
- Use the STAR method to probe answers — ask follow-ups if the candidate's answer lacks Situation, Task, Action, or Result
- After 2-3 behavioral questions, shift to situational/hypothetical questions
- Be encouraging but honest. If an answer is weak, gently push for more detail
- After 8-10 total exchanges, wrap up naturally and thank the candidate
- Keep your responses concise (2-3 sentences max for follow-ups)
- ALWAYS respond with a JSON object in this format:
{
  "message": "Your spoken response/question to the candidate",
  "questionType": "behavioral|situational|follow-up|closing",
  "isFollowUp": true/false,
  "shouldContinue": true/false,
  "questionNumber": 1
}`,

  technical: (jd, resume) => `You are a senior technical interviewer conducting a live mock interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:
- Ask ONE question at a time
- Start with conceptual questions, then move to problem-solving
- Cover: system design basics, data structures, algorithms, and domain-specific topics from the JD
- Ask follow-up questions to probe depth — e.g., "What's the time complexity?", "How would you optimize this?"
- If the candidate struggles, provide hints rather than answers
- After 8-10 total exchanges, wrap up naturally
- Keep responses concise
- ALWAYS respond with a JSON object:
{
  "message": "Your spoken response/question to the candidate",
  "questionType": "conceptual|problem-solving|follow-up|closing",
  "isFollowUp": true/false,
  "shouldContinue": true/false,
  "questionNumber": 1
}`,

  coding: (jd, resume) => `You are a senior technical interviewer conducting a live coding interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:
- Present ONE coding problem at a time
- Start with a clear problem statement including examples and constraints
- After presenting the problem, wait for the candidate to code a solution
- When reviewing their code, evaluate: correctness, edge cases, time/space complexity, code quality
- Ask follow-up questions: "Can you optimize this?", "What about edge case X?"
- Present 2-3 coding problems total, increasing in difficulty
- Keep responses concise
- ALWAYS respond with a JSON object:
{
  "message": "Your spoken response/question to the candidate",
  "questionType": "problem|review|follow-up|hint|closing",
  "isFollowUp": true/false,
  "shouldContinue": true/false,
  "questionNumber": 1,
  "codingProblem": {
    "title": "Problem Title",
    "description": "Full problem description",
    "examples": [{"input": "...", "output": "..."}],
    "constraints": ["constraint1"],
    "testCases": [{"input": "...", "expectedOutput": "..."}]
  }
}`
};

// ─── Start Session ────────────────────────────────────────────────
async function startSession(userId, jobDescription, mode) {
  // Fetch user resume for context
  let resumeText = '';
  try {
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (resume) resumeText = resume.text || '';
  } catch (err) {
    console.warn('Could not fetch resume:', err.message);
  }

  const sessionId = uuidv4();
  const systemPrompt = SYSTEM_PROMPTS[mode](jobDescription, resumeText);

  // Build initial conversation
  const conversationHistory = [
    { role: 'system', content: systemPrompt }
  ];

  // Get the first question from the AI
  const firstResponse = await callLLMWithHistory(conversationHistory);

  // Add assistant response to history
  conversationHistory.push({ role: 'assistant', content: JSON.stringify(firstResponse) });

  // Persist session
  const session = new LiveInterviewSession({
    sessionId,
    userId,
    mode,
    jobDescription,
    resumeContext: resumeText,
    conversationHistory,
    questions: [{
      questionText: firstResponse.message,
      questionType: firstResponse.questionType || mode,
      timestamp: new Date()
    }],
    status: 'active'
  });

  await session.save();

  return {
    sessionId,
    message: firstResponse.message,
    questionType: firstResponse.questionType,
    questionNumber: firstResponse.questionNumber || 1,
    codingProblem: firstResponse.codingProblem || null
  };
}

// ─── Respond to User Answer ──────────────────────────────────────
async function respondToAnswer(sessionId, userAnswer, codeSubmission = null) {
  const session = await LiveInterviewSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error('Session is no longer active');

  // Build the user message
  let userMessage = userAnswer;
  if (codeSubmission) {
    userMessage += `\n\n[CODE SUBMISSION]\nLanguage: ${codeSubmission.language}\n\`\`\`\n${codeSubmission.code}\n\`\`\`\nExecution Output:\n${codeSubmission.executionOutput || 'Not executed yet'}\nTest Results: ${codeSubmission.testResults ? JSON.stringify(codeSubmission.testResults) : 'N/A'}`;
  }

  // Add user answer to conversation
  session.conversationHistory.push({ role: 'user', content: userMessage });

  // Get AI response with full conversation context
  const aiResponse = await callLLMWithHistory(session.conversationHistory);

  // Add AI response to conversation
  session.conversationHistory.push({ role: 'assistant', content: JSON.stringify(aiResponse) });

  // Update the last question with user's answer
  const lastQuestion = session.questions[session.questions.length - 1];
  if (lastQuestion && !lastQuestion.userAnswer) {
    lastQuestion.userAnswer = userAnswer;
    if (codeSubmission) {
      lastQuestion.codeSubmission = codeSubmission;
    }
  }

  // If AI is continuing, add the new question
  if (aiResponse.shouldContinue) {
    session.questions.push({
      questionText: aiResponse.message,
      questionType: aiResponse.questionType || 'follow-up',
      timestamp: new Date()
    });
  }

  session.metrics.totalQuestions = session.questions.length;
  session.metrics.questionsAnswered = session.questions.filter(q => q.userAnswer).length;

  await session.save();

  return {
    message: aiResponse.message,
    questionType: aiResponse.questionType,
    isFollowUp: aiResponse.isFollowUp,
    shouldContinue: aiResponse.shouldContinue,
    questionNumber: aiResponse.questionNumber || session.questions.length,
    codingProblem: aiResponse.codingProblem || null
  };
}

// ─── End Session ─────────────────────────────────────────────────
async function endSession(sessionId) {
  const session = await LiveInterviewSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');

  // Generate comprehensive summary via LLM
  const summaryPrompt = `You conducted a mock ${session.mode} interview. Here is the full conversation:

${session.conversationHistory
  .filter(m => m.role !== 'system')
  .map(m => `${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`)
  .join('\n\n')}

Now provide a comprehensive evaluation as JSON:
{
  "overallScore": 7,
  "categoryScores": {
    "communication": 7,
    "technical": 8,
    "problemSolving": 7,
    "confidence": 6
  },
  "overallFeedback": "2-3 paragraph comprehensive assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"],
  "questionBreakdown": [
    { "question": "...", "score": 7, "feedback": "..." }
  ],
  "recommendations": ["rec1", "rec2", "rec3"]
}
Return ONLY the JSON.`;

  let summary;
  try {
    const rawResponse = await getLLMResponse(summaryPrompt);
    summary = JSON.parse(rawResponse);
  } catch (err) {
    console.error('Failed to generate summary:', err.message);
    summary = {
      overallScore: 6,
      categoryScores: { communication: 6, technical: 6, problemSolving: 6, confidence: 6 },
      overallFeedback: 'Interview completed. Review your answers to identify areas for improvement.',
      strengths: ['Completed the interview session'],
      improvements: ['Practice more structured responses'],
      recommendations: ['Continue practicing with mock interviews']
    };
  }

  // Update session metrics
  const startTime = session.startedAt || session.createdAt;
  const durationMinutes = (Date.now() - new Date(startTime).getTime()) / 1000 / 60;

  session.status = 'completed';
  session.completedAt = new Date();
  session.metrics = {
    totalQuestions: session.questions.length,
    questionsAnswered: session.questions.filter(q => q.userAnswer).length,
    averageScore: summary.overallScore,
    totalDurationMinutes: Math.round(durationMinutes * 10) / 10,
    overallFeedback: summary.overallFeedback,
    strengths: summary.strengths,
    improvements: summary.improvements,
    categoryScores: summary.categoryScores
  };

  // Track in heatmap
  try {
    const HeatmapService = require('./heatmapService');
    await HeatmapService.addActivity(session.userId.toString(), 'live_interview_completed', {
      description: `Completed live ${session.mode} mock interview (${session.questions.length} questions)`,
      metadata: { sessionId, mode: session.mode, score: summary.overallScore }
    });
  } catch (trackingErr) {
    console.warn('Heatmap tracking failed:', trackingErr.message);
  }

  await session.save();

  return {
    summary,
    metrics: session.metrics,
    questionCount: session.questions.length,
    durationMinutes: session.metrics.totalDurationMinutes
  };
}

// ─── Helper: Call LLM with conversation history ──────────────────
async function callLLMWithHistory(conversationHistory) {
  const messages = conversationHistory.map(m => ({
    role: m.role,
    content: m.content
  }));

  try {
    const axios = require('axios');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content;

    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Fallback: wrap plain text in expected format
      return {
        message: content,
        questionType: 'follow-up',
        isFollowUp: false,
        shouldContinue: true,
        questionNumber: 1
      };
    }
  } catch (error) {
    console.error('LLM call failed:', error.message);
    throw new Error(`Interview AI failed: ${error.message}`);
  }
}

module.exports = { startSession, respondToAnswer, endSession };
