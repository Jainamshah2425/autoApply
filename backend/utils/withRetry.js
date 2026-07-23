/**
 * Retry a function on Mongoose optimistic-concurrency conflicts.
 * Used for read-modify-write save() calls on documents that legitimately
 * get hit by concurrent requests (e.g. User.contributions/stats) — the
 * function should re-fetch fresh state on every attempt, not reuse a
 * stale document across retries.
 */
async function withRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === retries) throw err;
    }
  }
}

module.exports = { withRetry };
