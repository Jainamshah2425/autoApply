// services/readinessService.js
// Composite "job readiness" score across aptitude, interview, and resume
// target-skill coverage. Every function here is a weighted average, a
// substring match, or a threshold rule — no LLM, no embeddings, no trained
// model — deliberately, so every line is explainable without invoking ML.

const userStatsService = require('./userStatsService');
const User = require('../models/User');
const Resume = require('../models/Resume');

const WEIGHTS = { aptitude: 0.4, interview: 0.4, resumeCoverage: 0.2 };

/**
 * Pure — combines up to three 0-100 dimension scores into one weighted score.
 * A dimension of `null` means "not enough data yet", not "score of 0" — it's
 * excluded and the remaining weights are re-normalized to sum to 1.
 */
function computeReadinessScore({ aptitudeScore, interviewScore, resumeCoverageScore } = {}) {
  const dims = [
    ['aptitude', aptitudeScore, WEIGHTS.aptitude],
    ['interview', interviewScore, WEIGHTS.interview],
    ['resumeCoverage', resumeCoverageScore, WEIGHTS.resumeCoverage],
  ].filter(([, score]) => typeof score === 'number');

  if (!dims.length) return { overall: null, weights: {} };

  const totalWeight = dims.reduce((sum, [, , w]) => sum + w, 0);
  const overall = Math.round(
    dims.reduce((sum, [, score, w]) => sum + score * (w / totalWeight), 0)
  );
  const weights = Object.fromEntries(dims.map(([name, , w]) => [name, Math.round((w / totalWeight) * 100)]));
  return { overall, weights };
}

/**
 * Pure — case-insensitive substring match, resume text vs a user's declared
 * target skills. Deliberately not an LLM call: it's a small, bounded, fully
 * inspectable check, not a judgment call.
 */
function computeResumeSkillCoverage({ resumeText = '', targetSkills = [] } = {}) {
  const haystack = (resumeText || '').toLowerCase();
  const uniqueSkills = [...new Set(targetSkills.map((s) => (s || '').trim()).filter(Boolean))];
  if (!uniqueSkills.length) return { coveragePercent: null, matched: [], missing: [] };

  const matched = uniqueSkills.filter((skill) => haystack.includes(skill.toLowerCase()));
  const matchedSet = new Set(matched);
  const missing = uniqueSkills.filter((skill) => !matchedSet.has(skill));

  return {
    coveragePercent: Math.round((matched.length / uniqueSkills.length) * 100),
    matched,
    missing,
  };
}

/**
 * Pure — deterministic, threshold-based next-action suggestions from the
 * weakest 1-2 dimensions. Not LLM-generated.
 */
function buildRecommendations({ aptitudeScore, interviewScore, resumeCoverage, weakAptitudeTopics = [] } = {}) {
  const candidates = [
    ['aptitude', aptitudeScore],
    ['interview', interviewScore],
    ['resumeCoverage', resumeCoverage?.coveragePercent],
  ]
    .filter(([, score]) => typeof score === 'number')
    .sort((a, b) => a[1] - b[1]);

  const recs = [];
  for (const [dim, score] of candidates.slice(0, 2)) {
    if (dim === 'aptitude') {
      recs.push(
        weakAptitudeTopics.length
          ? `Practice aptitude: your weakest topics are ${weakAptitudeTopics.slice(0, 3).join(', ')}.`
          : 'Take an aptitude practice test to build a baseline.'
      );
    } else if (dim === 'interview') {
      recs.push(
        score < 50
          ? 'Do a live technical or behavioral interview — your recent scores are below average.'
          : 'Do another mock interview to keep your rolling average up.'
      );
    } else if (dim === 'resumeCoverage') {
      recs.push(
        resumeCoverage?.missing?.length
          ? `Add these target skills to your resume if you have experience with them: ${resumeCoverage.missing.slice(0, 3).join(', ')}.`
          : 'Upload a resume so we can check it against your target skills.'
      );
    }
  }
  if (recs.length < 2) {
    recs.push('Keep practicing consistently — check back after a few more sessions for tailored advice.');
  }
  return recs.slice(0, 3);
}

/**
 * Orchestrates the DB reads and normalizes scores onto a common 0-100 scale
 * before combining them.
 *
 * NOTE: both InterviewSession.sessionMetrics.averageScore and
 * LiveInterviewSession.metrics.averageScore are 1-10 scale (confirmed via
 * their actual LLM scoring prompts) — both get ×10'd here, not just one.
 * AptitudeAttempt.percentage is already 0-100.
 */
async function getReadiness(userId) {
  const [stats, user, resume] = await Promise.all([
    userStatsService.getCanonicalStats(userId),
    User.findById(userId).select('preferences settings'),
    Resume.findOne({ user: userId }).sort({ createdAt: -1 }).select('text'),
  ]);

  const aptitudeScore = stats.aptitude.completedAttempts > 0 ? stats.aptitude.averagePercentage : null;

  const normalizedInterviewScores = [
    typeof stats.interview.averageScore === 'number' ? stats.interview.averageScore * 10 : null,
    typeof stats.liveInterview.averageScore === 'number' ? stats.liveInterview.averageScore * 10 : null,
  ].filter((s) => typeof s === 'number');
  const interviewScore = normalizedInterviewScores.length
    ? Math.round(normalizedInterviewScores.reduce((a, b) => a + b, 0) / normalizedInterviewScores.length)
    : null;

  const targetSkills = [
    ...(user?.preferences?.skills || []),
    ...(user?.settings?.goals?.skillFocusAreas || []),
  ];
  const resumeCoverage = computeResumeSkillCoverage({ resumeText: resume?.text, targetSkills });

  const { overall, weights } = computeReadinessScore({
    aptitudeScore,
    interviewScore,
    resumeCoverageScore: resumeCoverage.coveragePercent,
  });

  const recommendations = buildRecommendations({
    aptitudeScore,
    interviewScore,
    resumeCoverage,
    weakAptitudeTopics: stats.aptitude.weakTopics,
  });

  return {
    overall,
    weights,
    dimensions: {
      aptitude: { score: aptitudeScore, weakTopics: stats.aptitude.weakTopics, attempts: stats.aptitude.completedAttempts },
      interview: {
        score: interviewScore,
        textSessions: stats.interview.completedSessions,
        liveSessions: stats.liveInterview.completedSessions,
      },
      resumeCoverage,
    },
    recommendations,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { computeReadinessScore, computeResumeSkillCoverage, buildRecommendations, getReadiness };
