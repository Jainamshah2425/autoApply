// routes/auth.js
const { google } = require('googleapis');
const express = require('express');
const { oauth2Client } = require('../config/google.js');
const User = require('../models/User.js');

const router = express.Router();

// Redirect to Google login
router.get('/google', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).send('Missing userId');
  }
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    state: userId,
  });
  res.redirect(authUrl);
});

// OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const userId = state;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens:', tokens);
    await User.findByIdAndUpdate(userId, { gmailTokens: tokens });
    console.log('Tokens saved for user:', userId);
    res.redirect(`${process.env.FRONTEND_URL}/upload?gmail=connected`);
  } catch (err) {
    console.error('Failed to get token', err);
    res.redirect(`${process.env.FRONTEND_URL}/upload?gmail=failed`);
  }
});

module.exports = router;
