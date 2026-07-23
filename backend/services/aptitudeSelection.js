// services/aptitudeSelection.js
// Pure functions for weighting aptitude question selection toward a user's
// weak topics. No DB/Mongoose imports — fully unit-testable in isolation.

/**
 * Given a target question count and a user's weak topics, compute how many
 * questions should come from weak-topic buckets vs the general pool. Falls
 * back to {weakQuota: 0, otherQuota: questionCount} when there are no weak
 * topics, preserving today's pure-random behavior for new users.
 */
function computeTopicQuotas({ questionCount, weakTopics = [], weakRatio = 0.55 }) {
  if (!weakTopics.length || questionCount <= 0) {
    return { weakQuota: 0, otherQuota: Math.max(questionCount, 0) };
  }
  const weakQuota = Math.min(questionCount, Math.round(questionCount * weakRatio));
  return { weakQuota, otherQuota: questionCount - weakQuota };
}

/**
 * Merge two candidate question pools into exactly `questionCount` questions,
 * truncating if combined is too many. If combined is short (e.g. not enough
 * weak-topic questions in the bank), returns fewer than requested — the
 * caller's existing "allow repeats" top-up fallback handles making up the gap.
 */
function mergeQuotaResults({ weakPoolQuestions = [], otherPoolQuestions = [], questionCount }) {
  const combined = [...weakPoolQuestions, ...otherPoolQuestions];
  return combined.length > questionCount ? combined.slice(0, questionCount) : combined;
}

module.exports = { computeTopicQuotas, mergeQuotaResults };
