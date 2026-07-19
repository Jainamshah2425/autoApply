const { getLLMResponse } = require('./llm');

const MAX_RESUME_CHARS = 12000;

/**
 * Build the resume-review prompt for Groq (JSON-only response).
 */
function buildResumeReviewPrompt({ resumeText, jobTitle = '', jobDescription = '' }) {
  const truncated = String(resumeText || '').slice(0, MAX_RESUME_CHARS);
  const targetBlock =
    jobTitle || jobDescription
      ? `
TARGET ROLE (tailor feedback to this when provided):
- Job title: ${jobTitle || '(not specified)'}
- Job description / requirements:
${jobDescription || '(not specified)'}
`
      : `
TARGET ROLE: Not specified. Give general internship/job-ready feedback.
`;

  return `You are an expert resume coach and ATS specialist for students and early-career candidates.

Review the resume below and return a JSON object ONLY (no markdown, no prose outside JSON) with this exact shape:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentences>",
  "strengths": ["<bullet>", "..."],
  "gaps": ["<bullet>", "..."],
  "atsTips": ["<bullet>", "..."],
  "sectionFeedback": {
    "contact": "<short note>",
    "experience": "<short note>",
    "skills": "<short note>",
    "education": "<short note>"
  }
}

Rules:
- Be specific and actionable; reference resume content when possible.
- Prefer 3-6 items each for strengths, gaps, and atsTips.
- Score honestly for early-career resumes (do not inflate).
${targetBlock}
--- START RESUME ---
${truncated}
--- END RESUME ---`;
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
 * Parse and normalize LLM JSON into the review schema.
 * @throws {Error} with status 502 when JSON is invalid
 */
function parseResumeReview(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    const err = new Error('Resume review failed: invalid JSON from LLM');
    err.status = 502;
    throw err;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error('Resume review failed: unexpected LLM response shape');
    err.status = 502;
    throw err;
  }

  const section = parsed.sectionFeedback && typeof parsed.sectionFeedback === 'object'
    ? parsed.sectionFeedback
    : {};

  return {
    overallScore: clampScore(parsed.overallScore),
    summary: String(parsed.summary || '').trim() || 'No summary provided.',
    strengths: asStringArray(parsed.strengths),
    gaps: asStringArray(parsed.gaps),
    atsTips: asStringArray(parsed.atsTips),
    sectionFeedback: {
      contact: String(section.contact || '').trim() || 'No feedback.',
      experience: String(section.experience || '').trim() || 'No feedback.',
      skills: String(section.skills || '').trim() || 'No feedback.',
      education: String(section.education || '').trim() || 'No feedback.',
    },
  };
}

/**
 * Generate structured resume feedback via Groq.
 */
async function generateResumeReview({
  resumeText,
  jobTitle = '',
  jobDescription = '',
  userId = null,
}) {
  if (!resumeText || !String(resumeText).trim()) {
    const err = new Error('Resume text is empty. Re-upload a text-based PDF.');
    err.status = 400;
    throw err;
  }

  const prompt = buildResumeReviewPrompt({ resumeText, jobTitle, jobDescription });
  const raw = await getLLMResponse(prompt, userId, { maxTokens: 2000, jsonMode: true });
  return parseResumeReview(raw);
}

module.exports = {
  MAX_RESUME_CHARS,
  buildResumeReviewPrompt,
  parseResumeReview,
  generateResumeReview,
};
