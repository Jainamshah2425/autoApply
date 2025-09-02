const { google } = require('googleapis');
const User = require('../models/User');

const gmailCheck = async (req, res, next) => {
  console.log('🔍 Initiating Gmail check...');
  const { userId } = req.body;

  if (!userId) {
    console.error('❌ Gmail Check Failed: User ID is required.');
    return res.status(400).json({ 
      success: false, 
      error: 'User ID is required', 
      needsAuth: false 
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ Gmail Check Failed: User not found for ID: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'User not found', 
        needsAuth: false 
      });
    }

    // Check if Gmail tokens exist
    if (!user.gmailTokens || !user.gmailTokens.access_token) {
      console.warn(`⚠️  User ${userId} has not connected their Gmail account.`);
      return res.status(401).json({ 
        success: false, 
        error: 'Gmail not connected. Please connect your Gmail account first.', 
        needsAuth: true 
      });
    }

    console.log(`✅ User ${userId} found. Checking token status...`);
    
    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('❌ Missing required Google OAuth environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error. Please contact support.',
        needsAuth: false
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log(`🔑 Setting credentials for user ${userId}:`, {
      hasAccessToken: !!user.gmailTokens.access_token,
      hasRefreshToken: !!user.gmailTokens.refresh_token,
      expiryDate: user.gmailTokens.expiry_date ? new Date(user.gmailTokens.expiry_date) : 'No expiry set',
      isExpired: user.gmailTokens.expiry_date ? user.gmailTokens.expiry_date < Date.now() : false
    });

    oauth2Client.setCredentials(user.gmailTokens);

    // Check if the token is expired and attempt refresh
    if (user.gmailTokens.expiry_date && user.gmailTokens.expiry_date < Date.now()) {
      console.log(`⏰ Token for user ${userId} has expired. Attempting to refresh...`);
      
      if (!user.gmailTokens.refresh_token) {
        console.error(`❌ No refresh token available for user ${userId}`);
        return res.status(401).json({
          success: false,
          error: 'Gmail access expired and no refresh token available. Please reconnect your Gmail account.',
          needsAuth: true,
        });
      }

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log(`🔄 Token for user ${userId} refreshed successfully.`);
        
        // Update user's tokens in the database
        user.gmailTokens = {
          ...user.gmailTokens,
          ...credentials
        };
        await user.save();
        
        console.log(`💾 New tokens for user ${userId} saved to database.`);
        oauth2Client.setCredentials(user.gmailTokens);
      } catch (refreshError) {
        console.error(`❌ Failed to refresh token for user ${userId}:`, refreshError.message);
        return res.status(401).json({
          success: false,
          error: 'Gmail token expired and refresh failed. Please reconnect your Gmail account.',
          needsAuth: true,
        });
      }
    } else {
      console.log(`✅ Token for user ${userId} is still valid.`);
    }

    // Attach the authorized client to the request object for use in next services
    req.oauth2Client = oauth2Client;
    console.log(`🎉 Gmail check passed for user: ${userId}`);
    next();
  } catch (error) {
    console.error(`💥 Internal server error during Gmail check for user ${userId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during Gmail check', 
      needsAuth: false 
    });
  }
};

module.exports = gmailCheck;
