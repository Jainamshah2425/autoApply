const jwt = require('jsonwebtoken');

// Verifies the bearer access token minted by the frontend's NextAuth session
// callback (signed with the same NEXTAUTH_SECRET both apps share).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    req.auth = { userId: payload.userId, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
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
