// routes/auth.js
const { google } = require('googleapis');
const express = require('express');
const jwt = require('jsonwebtoken');
const { oauth2Client } = require('../config/google.js');
const User = require('../models/User.js');

const router = express.Router();

// Redirect to Google login. This is a full browser navigation (not an axios
// call), so the caller can't send an Authorization header — instead it must
// pass the same short-lived access token the frontend already mints for API
// calls, verified here before it's trusted as the OAuth `state`.
router.get('/google', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(401).send('Missing token');
  }

  let userId;
  try {
    userId = jwt.verify(token, process.env.NEXTAUTH_SECRET).userId;
  } catch (err) {
    return res.status(401).send('Invalid or expired token');
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
