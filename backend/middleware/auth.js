const jwt = require('jsonwebtoken');

// Verifies the bearer access token minted by the frontend's NextAuth session
// callback (signed with the same NEXTAUTH_SECRET both apps share).
function requireAuth(req, res, next) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error('requireAuth: NEXTAUTH_SECRET is not set on the backend');
    return res.status(500).json({
      error: 'Server auth misconfigured (NEXTAUTH_SECRET missing).',
    });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized — sign in again. Missing access token.',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    if (!payload.userId) {
      return res.status(401).json({
        error: 'Unauthorized — session incomplete. Sign out and sign in again.',
      });
    }
    req.auth = { userId: payload.userId, email: payload.email };
    next();
  } catch (err) {
    const reason = err.name === 'TokenExpiredError'
      ? 'Session expired. Sign in again.'
      : 'Unauthorized — invalid token. Confirm NEXTAUTH_SECRET matches on Vercel and Render, then sign in again.';
    return res.status(401).json({ error: reason });
  }
}

// Use after requireAuth on routes with a :userId param — rejects requests
// where the authenticated user doesn't match the id in the URL.
function requireOwnUserId(paramName = 'userId') {
  return (req, res, next) => {
    if (req.params[paramName] !== req.auth?.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireOwnUserId };
