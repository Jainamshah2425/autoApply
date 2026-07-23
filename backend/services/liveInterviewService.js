// services/liveInterviewService.js
// Core orchestration for the live AI interview — manages conversation state,
// generates follow-ups, and produces session summaries.

const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const { getLLMResponse } = require('./llm.js');
const LiveInterviewSession = require('../models/LiveInterviewSession.js');
const Resume = require('../models/Resume.js');

function weakestCategoryLine(weakestCategory) {
  return weakestCategory
    ? `\n- This candidate's rolling average across recent sessions is weakest in "${weakestCategory}" — weight your questions to probe that area more than the others.`
    : '';
}

// ─── System Prompts ───────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  behavioral: (jd, resume, weakestCategory) => `You are a senior HR interviewer conducting a live mock interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:${weakestCategoryLine(weakestCategory)}
- Ask ONE question at a time
- TURN-TAKING (CRITICAL): This is a LIVE interview. Wait for the candidate to answer before asking the next question.
- NEVER invent, assume, or simulate the candidate's answers
- NEVER output multiple interviewer turns in one response
- Each turn: briefly acknowledge their previous answer (if any), then ask at most ONE new question
- Start with a brief greeting and ONE opening question only
- Use the STAR method to probe answers — ask follow-ups if the candidate's answer lacks Situation, Task, Action, or Result
- After 2-3 behavioral questions, shift to situational/hypothetical questions
- Be encouraging but honest. If an answer is weak, gently push for more detail
- After 8-10 total exchanges, wrap up naturally and thank the candidate
- Set shouldContinue to false ONLY for final closing remarks (no more questions)
- Keep your responses concise (2-3 sentences max for follow-ups)
- ALWAYS respond with a JSON object in this format:
{
  "message": "Your spoken response/question to the candidate",
  "questionType": "behavioral|situational|follow-up|closing",
  "isFollowUp": true/false,
  "shouldContinue": true/false,
  "questionNumber": 1
}`,

  technical: (jd, resume, weakestCategory) => `You are a senior technical interviewer conducting a live mock interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:${weakestCategoryLine(weakestCategory)}
- Ask ONE question at a time
- TURN-TAKING (CRITICAL): Wait for the candidate to answer before your next question. Never invent their answers.
- Each turn: acknowledge their previous answer briefly, then ask at most ONE follow-up or new question
- Start with conceptual questions, then move to problem-solving
- Cover: system design basics, data structures, algorithms, and domain-specific topics from the JD
- Ask follow-up questions to probe depth — e.g., "What's the time complexity?", "How would you optimize this?"
- If the candidate struggles, provide hints rather than answers
- After 8-10 total exchanges, wrap up naturally
- Set shouldContinue to false ONLY for final closing remarks
- Keep responses concise
- ALWAYS respond with a JSON object:
{
  "message": "Your spoken response/question to the candidate",
  "questionType": "conceptual|problem-solving|follow-up|closing",
  "isFollowUp": true/false,
  "shouldContinue": true/false,
  "questionNumber": 1
}`,

  coding: (jd, resume, weakestCategory) => `You are a senior technical interviewer conducting a live coding interview.

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resume || 'Not provided'}

RULES:${weakestCategoryLine(weakestCategory)}
- Present ONE coding problem at a time
- TURN-TAKING (CRITICAL): Wait for the candidate to respond or submit code before continuing. Never invent their answers.
- After presenting a problem, STOP and wait — do not ask the next problem until they respond
- When reviewing their code, evaluate: correctness, edge cases, time/space complexity, code quality
- Ask follow-up questions: "Can you optimize this?", "What about edge case X?"
- Present 2-3 coding problems total, increasing in difficulty
- Set shouldContinue to false ONLY for final closing remarks
- Keep responses concise
- The candidate can code in Python, Java, or C++. "starterCode" is REQUIRED to contain all three keys — "python", "java", AND "cpp" — every single time you present a problem or set codingProblem to non-null. Never omit a language. Never include any other language key.
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
    "functionSignature": "def solve(nums: List[int]) -> int:",
    "starterCode": {
      "python": "from typing import List\\n\\n# TODO: implement the function below\\ndef solve(nums: List[int]) -> int:\\n    pass\\n",
      "java": "import java.util.*;\\n\\nclass Solution {\\n    // TODO: implement the method below\\n    public int solve(int[] nums) {\\n        return 0;\\n    }\\n}\\n",
      "cpp": "#include <bits/stdc++.h>\\nusing namespace std;\\n\\n// TODO: implement the function below\\nint solve(vector<int>& nums) {\\n    return 0;\\n}\\n"
    },
    "testCases": [{"input": "...", "expectedOutput": "..."}]
  }
}`
};

function formatMessageForLLM(entry) {
  if (entry.role === 'assistant') {
    try {
      const parsed = JSON.parse(entry.content);
      if (parsed?.message) {
        return { role: 'assistant', content: parsed.message };
      }
    } catch {
      // already plain text
    }
  }
  return { role: entry.role, content: entry.content };
}

function normalizeAiResponse(parsed, { questionCount = 1, hasUserAnswer = false } = {}) {
  const message =
    (typeof parsed.message === 'string' && parsed.message.trim()) ||
    (typeof parsed.content === 'string' && parsed.content.trim()) ||
    '';

  if (!message) {
    throw new Error('AI returned an empty message');
  }

  const questionType = parsed.questionType || 'follow-up';
  const isClosing =
    questionType === 'closing' ||
    /\b(thank you for your time|that concludes our interview|this concludes|we're done|interview is complete)\b/i.test(message);

  return {
    message,
    questionType,
    isFollowUp: Boolean(parsed.isFollowUp) || (hasUserAnswer && questionType === 'follow-up'),
    shouldContinue: isClosing ? false : parsed.shouldContinue !== false,
    questionNumber: parsed.questionNumber || questionCount,
    codingProblem: parsed.codingProblem || null,
  };
}

function parseAiContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { message: content };
  }
}

// ─── Rolling category-score bias (deterministic, no ML) ──────────
// Averages a user's last N completed sessions' categoryScores. The decision
// of which category to emphasize is a plain aggregation + sort — the LLM
// only ever receives the resulting category name as a prompt instruction,
// it never decides which category is weakest itself.
async function getRollingCategoryScores(userId, { limit = 10 } = {}) {
  const sessions = await LiveInterviewSession.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    { $sort: { completedAt: -1 } },
    { $limit: limit },
    {
      $group: {
        _id: null,
        communication: { $avg: '$metrics.categoryScores.communication' },
        technical: { $avg: '$metrics.categoryScores.technical' },
        problemSolving: { $avg: '$metrics.categoryScores.problemSolving' },
        confidence: { $avg: '$metrics.categoryScores.confidence' },
        sampleSize: { $sum: 1 }
      }
    }
  ]);
  return sessions[0] || null;
}

// Pure — no DB access, trivially unit-testable.
function pickWeakestCategory(categoryScores) {
  if (!categoryScores) return null;
  const { sampleSize, _id, ...scores } = categoryScores;
  const entries = Object.entries(scores).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

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

  let weakestCategory = null;
  try {
    const rolling = await getRollingCategoryScores(userId);
    weakestCategory = pickWeakestCategory(rolling);
  } catch (err) {
    console.warn('Could not compute rolling category scores:', err.message);
  }

  const sessionId = uuidv4();
  const systemPrompt = SYSTEM_PROMPTS[mode](jobDescription, resumeText, weakestCategory);

  // Build initial conversation — user kickoff ensures the model waits for real answers
  const conversationHistory = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Hello, I am ready to begin the interview.' },
  ];

  const firstResponse = await callLLMWithHistory(conversationHistory, {
    questionCount: 1,
    hasUserAnswer: false,
  });

  conversationHistory.push({ role: 'assistant', content: firstResponse.message });

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

// ─── Concurrency: claim/release lock ──────────────────────────────
const STALE_LOCK_MS = 2 * 60 * 1000;

async function claimSession(sessionId) {
  const session = await LiveInterviewSession.findOneAndUpdate(
    {
      sessionId,
      $or: [
        { locked: { $ne: true } },
        { lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } }
      ]
    },
    { $set: { locked: true, lockedAt: new Date() } },
    { new: true }
  );
  if (session) return session;

  const exists = await LiveInterviewSession.exists({ sessionId });
  if (!exists) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  const err = new Error('Session is busy processing another response');
  err.status = 409;
  throw err;
}

async function releaseSession(sessionId) {
  await LiveInterviewSession.updateOne({ sessionId }, { $set: { locked: false } });
}

// ─── Respond to User Answer ──────────────────────────────────────
async function respondToAnswer(sessionId, userAnswer, codeSubmission = null) {
  const session = await claimSession(sessionId);
  try {
  if (session.status !== 'active') throw new Error('Session is no longer active');

  // Build the user message
  let userMessage = userAnswer;
  if (codeSubmission) {
    userMessage += `\n\n[CODE SUBMISSION]\nLanguage: ${codeSubmission.language}\n\`\`\`\n${codeSubmission.code}\n\`\`\`\nExecution Output:\n${codeSubmission.executionOutput || 'Not executed yet'}\nTest Results: ${codeSubmission.testResults ? JSON.stringify(codeSubmission.testResults) : 'N/A'}`;
  }

  session.conversationHistory.push({ role: 'user', content: userMessage });

  const aiResponse = await callLLMWithHistory(session.conversationHistory, {
    questionCount: session.questions.length + 1,
    hasUserAnswer: true,
  });

  session.conversationHistory.push({ role: 'assistant', content: aiResponse.message });

  // Update the last question with user's answer
  const lastQuestion = session.questions[session.questions.length - 1];
  if (lastQuestion && !lastQuestion.userAnswer) {
    lastQuestion.userAnswer = userAnswer;
    if (codeSubmission) {
      lastQuestion.codeSubmission = codeSubmission;
    }
  }

  // If AI is continuing with a new question, track it
  if (aiResponse.shouldContinue && aiResponse.questionType !== 'closing') {
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
  } finally {
    await releaseSession(sessionId);
  }
}

// ─── End Session ─────────────────────────────────────────────────
async function endSession(sessionId) {
  const session = await claimSession(sessionId);
  try {

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

  // Track in heatmap — guarded by heatmapRecorded so a retry after a
  // partial failure (e.g. session.save() below throwing) doesn't record
  // the activity twice; the flag is persisted in the same save() as the
  // rest of the session state, not as a separate write.
  if (!session.heatmapRecorded) {
    try {
      const HeatmapService = require('./heatmapService');
      await HeatmapService.addActivity(session.userId.toString(), 'live_interview_completed', {
        description: `Completed live ${session.mode} mock interview (${session.questions.length} questions)`,
        metadata: { sessionId, mode: session.mode, score: summary.overallScore }
      });
      session.heatmapRecorded = true;
    } catch (trackingErr) {
      console.warn('Heatmap tracking failed:', trackingErr.message);
    }
  }

  await session.save();

  return {
    summary,
    metrics: session.metrics,
    questionCount: session.questions.length,
    durationMinutes: session.metrics.totalDurationMinutes
  };
  } finally {
    await releaseSession(sessionId);
  }
}

// ─── Helper: Call LLM with conversation history ──────────────────
async function callLLMWithHistory(conversationHistory, context = {}) {
  const messages = conversationHistory.map(formatMessageForLLM);

  const last = messages[messages.length - 1];
  if (last?.role !== 'user') {
    throw new Error('Invalid conversation state: expected user message before AI reply');
  }

  try {
    const axios = require('axios');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
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
    const parsed = parseAiContent(content);
    return normalizeAiResponse(parsed, context);
  } catch (error) {
    console.error('LLM call failed:', error.message);
    throw new Error(`Interview AI failed: ${error.message}`);
  }
}

module.exports = { startSession, respondToAnswer, endSession, getRollingCategoryScores, pickWeakestCategory };
