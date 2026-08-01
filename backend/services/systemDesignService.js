const SystemDesignQuestion = require('../models/SystemDesignQuestion.js');
const SystemDesignAttempt = require('../models/SystemDesignAttempt.js');
const { getLLMResponse } = require('./llm.js');

const MAX_ANSWER_CHARS = 8000;

/**
 * List question metadata only — no prompt/reference spoilers.
 */
async function listQuestions() {
  return SystemDesignQuestion.find()
    .select('title slug difficulty keyTopics estimatedMinutes')
    .sort({ difficulty: 1, title: 1 });
}

/**
 * Full prompt + requirement hints for practicing. Reference approach is
 * withheld here — it's only returned after a submission is graded.
 */
async function getQuestion(slugOrId) {
  const query = slugOrId.match(/^[0-9a-fA-F]{24}$/) ? { _id: slugOrId } : { slug: slugOrId };
  return SystemDesignQuestion.findOne(query)
    .select('title slug difficulty prompt functionalRequirements nonFunctionalRequirements keyTopics estimatedMinutes');
}

/**
 * Build the grading prompt for Groq (JSON-only response).
 */
function buildEvaluationPrompt({ question, answerText }) {
  const truncated = String(answerText || '').slice(0, MAX_ANSWER_CHARS);

  return `You are a staff engineer conducting a system design interview.

PROBLEM: "${question.title}"
${question.prompt}

FUNCTIONAL REQUIREMENTS:
${(question.functionalRequirements || []).map((r) => `- ${r}`).join('\n') || '(none listed)'}

NON-FUNCTIONAL REQUIREMENTS:
${(question.nonFunctionalRequirements || []).map((r) => `- ${r}`).join('\n') || '(none listed)'}

A SOLID REFERENCE APPROACH (for your grading context only — do not quote it back verbatim):
${(question.referenceApproach || []).map((r) => `- ${r}`).join('\n') || '(none listed)'}

CANDIDATE'S WRITTEN ANSWER:
--- START ANSWER ---
${truncated}
--- END ANSWER ---

Grade the candidate's answer and return a JSON object ONLY (no markdown, no prose outside JSON) with this exact shape:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentences overall assessment>",
  "strengths": ["<bullet>", "..."],
  "gaps": ["<bullet>", "..."],
  "requirementsCoverage": "<short note on how well functional/non-functional requirements were addressed>",
  "scalabilityNotes": "<short note on scalability, reliability, and trade-off reasoning>",
  "communicationNotes": "<short note on structure/clarity of the write-up>"
}

Rules:
- Be specific and reference the candidate's answer content when possible.
- Prefer 3-6 items each for strengths and gaps.
- Score honestly; a vague or incomplete answer should score low.`;
}

function asStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Parse and normalize LLM JSON into the feedback schema.
 * @throws {Error} with status 502 when JSON is invalid
 */
function parseEvaluation(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    const err = new Error('System design evaluation failed: invalid JSON from LLM');
    err.status = 502;
    throw err;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error('System design evaluation failed: unexpected LLM response shape');
    err.status = 502;
    throw err;
  }

  return {
    overallScore: clampScore(parsed.overallScore),
    summary: String(parsed.summary || '').trim() || 'No summary provided.',
    strengths: asStringArray(parsed.strengths),
    gaps: asStringArray(parsed.gaps),
    requirementsCoverage: String(parsed.requirementsCoverage || '').trim() || 'No feedback.',
    scalabilityNotes: String(parsed.scalabilityNotes || '').trim() || 'No feedback.',
    communicationNotes: String(parsed.communicationNotes || '').trim() || 'No feedback.',
  };
}

/**
 * Grade a submission via Groq and persist the attempt.
 */
async function evaluateSubmission({ userId, questionId, answerText, timeSpentSeconds = 0 }) {
  if (!answerText || !String(answerText).trim()) {
    const err = new Error('Answer is empty. Write your design approach before submitting.');
    err.status = 400;
    throw err;
  }

  const question = await SystemDesignQuestion.findById(questionId);
  if (!question) {
    const err = new Error('Question not found');
    err.status = 404;
    throw err;
  }

  const prompt = buildEvaluationPrompt({ question, answerText });
  const raw = await getLLMResponse(prompt, userId, { maxTokens: 1200, jsonMode: true });
  const feedback = parseEvaluation(raw);

  const attempt = await SystemDesignAttempt.create({
    userId,
    questionId,
    answerText,
    timeSpentSeconds,
    feedback,
    status: 'completed',
    completedAt: new Date(),
  });

  return { attemptId: attempt._id, feedback, referenceApproach: question.referenceApproach };
}

module.exports = {
  listQuestions,
  getQuestion,
  buildEvaluationPrompt,
  parseEvaluation,
  evaluateSubmission,
};
