const express = require('express');
const { sendUserEmail } = require('../services/email');
const gmailCheck = require('../middleware/gmailCheck');
const User = require('../models/User');
const { requireAuth, requireOwnUserId } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Debug endpoint to check Gmail connection status
router.get('/gmail-status/:userId', requireOwnUserId(), async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const status = {
      userId: userId,
      hasGmailTokens: !!user.gmailTokens,
      hasAccessToken: !!(user.gmailTokens?.access_token),
      hasRefreshToken: !!(user.gmailTokens?.refresh_token),
      tokenExpiry: user.gmailTokens?.expiry_date ? new Date(user.gmailTokens.expiry_date) : null,
      isTokenExpired: user.gmailTokens?.expiry_date ? user.gmailTokens.expiry_date < Date.now() : null,
      tokenScope: user.gmailTokens?.scope || null
    };

    console.log(`📊 Gmail status for user ${userId}:`, status);
    res.json({ success: true, status });
  } catch (error) {
    console.error(`Error checking Gmail status for user ${userId}:`, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/send', (req, res, next) => {
  req.body.userId = req.auth.userId;
  next();
}, gmailCheck, async (req, res) => {
  const { userId, to, subject, message } = req.body;
  console.log(`📧 Received email request for user: ${userId} to: ${to}`);

  try {
    // The authorized oauth2Client is now attached to the request by the middleware
    const result = await sendUserEmail(req.oauth2Client, userId, to, subject, message);
    console.log(`✅ Email successfully sent for user: ${userId}`);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`❌ Failed to send email for user ${userId}:`, err.message);
    // Determine status code based on error
    const statusCode = err.message.includes('authentication failed') ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

module.exports = router;

