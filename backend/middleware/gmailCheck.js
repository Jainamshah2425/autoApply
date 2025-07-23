const { google } = require('googleapis');
const User = require('../models/User');

const gmailCheck = async (req, res, next) => {
  console.log('Initiating Gmail check...');
  const { userId } = req.body;

  if (!userId) {
    console.error('Gmail Check Failed: User ID is required.');
    return res.status(400).json({ success: false, error: 'User ID is required', needsAuth: false });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`Gmail Check Failed: User not found for ID: ${userId}`);
      return res.status(404).json({ success: false, error: 'User not found', needsAuth: false });
    }

    if (!user.gmailTokens || !user.gmailTokens.access_token) {
      console.warn(`User ${userId} has not connected their Gmail account.`);
      return res.status(401).json({ success: false, error: 'Gmail not connected. Please connect your account.', needsAuth: true });
    }

    console.log(`User ${userId} found. Checking token status...`);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(user.gmailTokens);

    // Check if the token is expired
    if (user.gmailTokens.expiry_date && user.gmailTokens.expiry_date < Date.now()) {
      console.log(`Token for user ${userId} has expired. Attempting to refresh...`);
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log(`Token for user ${userId} refreshed successfully.`);
        
        // Update user's tokens in the database
        user.gmailTokens = credentials;
        await user.save();
        
        console.log(`New tokens for user ${userId} saved to database.`);
      } catch (refreshError) {
        console.error(`Failed to refresh token for user ${userId}:`, refreshError.message);
        return res.status(401).json({
          success: false,
          error: 'Gmail token expired and refresh failed. Please reconnect your Gmail account.',
          needsAuth: true,
        });
      }
    } else {
      console.log(`Token for user ${userId} is still valid.`);
    }

    // Attach the authorized client to the request object for use in next services
    req.oauth2Client = oauth2Client;
    console.log(`Gmail check passed for user: ${userId}`);
    next();
  } catch (error) {
    console.error(`Internal server error during Gmail check for user ${userId}:`, error);
    res.status(500).json({ success: false, error: 'Internal server error during Gmail check', needsAuth: false });
  }
};

module.exports = gmailCheck;
