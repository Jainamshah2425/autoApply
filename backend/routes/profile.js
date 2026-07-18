const express = require('express');
const router = express.Router();
const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');

// Get user profile with comprehensive data
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user basic info
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const stats = await getUserStats(userId);
    
    // Get user contributions for heatmap
    const contributions = await getUserContributions(userId);

    // Get user settings
    const settings = user.settings || {};

    const profileData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        linkedIn: user.linkedIn,
        github: user.github,
        bio: user.bio,
        location: user.location,
        profilePicture: user.profilePicture,
        joinedDate: user.createdAt,
        lastActive: user.lastActive || user.updatedAt,
        currentTitle: user.currentTitle,
        company: user.company
      },
      stats,
      contributions,
      settings
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updates.password;
    delete updates._id;
    delete updates.createdAt;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        ...updates,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user settings
router.put('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { settings } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        settings,
        updatedAt: new Date()
      },
      { new: true }
    ).select('settings');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate user statistics
async function getUserStats(userId) {
  try {
    const [
      totalInterviews,
      interviewSessions,
    ] = await Promise.all([
      InterviewSession.countDocuments({ userId }),
      InterviewSession.find({ userId }).sort({ createdAt: -1 }).limit(50),
    ]);

    // Calculate total questions from interview sessions
    const totalQuestions = interviewSessions.reduce((sum, session) => {
      return sum + (session.questions?.length || 0);
    }, 0);

    // Calculate average scores from interview sessions
    const scoresWithValues = interviewSessions.filter(session => 
      session.overallScore && typeof session.overallScore === 'number'
    );
    const averageScore = scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((sum, session) => sum + session.overallScore, 0) / scoresWithValues.length)
      : 0;

    // Calculate improvement rate from session scores
    let improvementRate = 0;
    if (scoresWithValues.length >= 2) {
      const first = scoresWithValues[scoresWithValues.length - 1].overallScore;
      const last = scoresWithValues[0].overallScore;
      if (first > 0) {
        improvementRate = Math.round(((last - first) / first) * 100);
      }
    }

    const experiencePoints = totalInterviews * 100 + totalQuestions * 10;
    // Get favorite topics
    const topicCounts = {};
    interviewSessions.forEach(session => {
      if (session.topic) {
        topicCounts[session.topic] = (topicCounts[session.topic] || 0) + 1;
      }
    });
    
    const favoriteTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const currentStreak = calculateCurrentStreak(interviewSessions);
    const level = Math.floor(experiencePoints / 1000) + 1;
    const nextLevelPoints = level * 1000;

    // Weekly progress
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weeklyProgress = await InterviewSession.countDocuments({
      userId,
      createdAt: { $gte: weekStart }
    });

    const weeklyGoal = 5; // Default weekly goal

    return {
      totalInterviews,
      totalQuestions,
      averageScore,
      improvementRate,
      favoriteTopics,
      currentStreak,
      level,
      experiencePoints,
      nextLevelPoints,
      weeklyGoal,
      weeklyProgress,
      recentAchievements: [] // TODO: Implement achievements system
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {};
  }
}

// Helper function to calculate current streak
function calculateCurrentStreak(interviewSessions) {
  if (!interviewSessions.length) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Get unique days with interviews
  const interviewDays = new Set(
    interviewSessions.map(session => {
      const date = new Date(session.createdAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );

  // Check backwards from today
  while (true) {
    if (interviewDays.has(checkDate.getTime())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (currentStreak > 0 || checkDate.getTime() === today.getTime()) {
      // If we have a streak and hit a gap, or if today has no interviews, break
      if (checkDate.getTime() !== today.getTime()) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
}

module.exports = router;
