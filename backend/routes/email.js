const express = require('express');
const { sendUserEmail } = require('../services/email');
const gmailCheck = require('../middleware/gmailCheck');

const router = express.Router();

router.post('/send', gmailCheck, async (req, res) => {
  const { userId, to, subject, message } = req.body;
  console.log(`Received email request for user: ${userId} to: ${to}`);

  try {
    // The authorized oauth2Client is now attached to the request by the middleware
    const result = await sendUserEmail(req.oauth2Client, userId, to, subject, message);
    console.log(`Email successfully sent for user: ${userId}`);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`Failed to send email for user ${userId}:`, err.message);
    // Determine status code based on error
    const statusCode = err.message.includes('authentication failed') ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

module.exports = router;

