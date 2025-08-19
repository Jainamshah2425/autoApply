const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Video = require('../models/Video');
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

// Get user contributions for heatmap
router.get('/contributions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { year = new Date().getFullYear() } = req.query;
    
    const contributions = await getUserContributions(userId, parseInt(year));
    res.json(contributions);
  } catch (error) {
    console.error('Error fetching user contributions:', error);
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
      totalVideos,
      interviewSessions,
      recentVideos
    ] = await Promise.all([
      InterviewSession.countDocuments({ userId }),
      Video.countDocuments({ userId }),
      InterviewSession.find({ userId }).sort({ createdAt: -1 }).limit(50),
      Video.find({ userId }).sort({ createdAt: -1 }).limit(20)
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

    // Calculate total video time
    const totalVideoTime = recentVideos.reduce((sum, video) => {
      return sum + (video.duration || 0);
    }, 0);

    // Calculate behavioral scores from recent videos
    const videosWithAnalysis = recentVideos.filter(video => video.behavioralAnalysis);
    const behavioralScores = {};
    
    if (videosWithAnalysis.length > 0) {
      const avgSpeakingRate = videosWithAnalysis.reduce((sum, video) => 
        sum + (video.behavioralAnalysis.speaking_rate || 0), 0) / videosWithAnalysis.length;
      
      const avgEyeContact = videosWithAnalysis.reduce((sum, video) => 
        sum + (video.behavioralAnalysis.eye_contact_score || 0), 0) / videosWithAnalysis.length;
      
      const avgConfidence = videosWithAnalysis.reduce((sum, video) => 
        sum + (video.behavioralAnalysis.confidence_score || 0), 0) / videosWithAnalysis.length;

      behavioralScores.speakingRate = Math.round(avgSpeakingRate);
      behavioralScores.eyeContact = Math.round(avgEyeContact);
      behavioralScores.confidence = Math.round(avgConfidence);
    }

    // Calculate improvement rate (comparing first and last 5 sessions)
    let improvementRate = 0;
    if (scoresWithValues.length >= 10) {
      const firstFive = scoresWithValues.slice(-5);
      const lastFive = scoresWithValues.slice(0, 5);
      const firstAvg = firstFive.reduce((sum, s) => sum + s.overallScore, 0) / 5;
      const lastAvg = lastFive.reduce((sum, s) => sum + s.overallScore, 0) / 5;
      improvementRate = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
    }

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

    // Calculate current streak
    const currentStreak = calculateCurrentStreak(interviewSessions);

    // Calculate level and experience points
    const experiencePoints = totalInterviews * 100 + totalQuestions * 10 + Math.floor(totalVideoTime / 60) * 5;
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
      totalVideoTime,
      favoriteTopics,
      behavioralScores,
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

// Helper function to get user contributions for heatmap
async function getUserContributions(userId, year = new Date().getFullYear()) {
  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    // Get all interview sessions and videos for the year
    const [interviews, videos] = await Promise.all([
      InterviewSession.find({
        userId,
        createdAt: { $gte: startDate, $lt: endDate }
      }).select('createdAt topic'),
      Video.find({
        userId,
        createdAt: { $gte: startDate, $lt: endDate }
      }).select('createdAt')
    ]);

    // Create daily contribution map
    const contributions = {};
    
    // Initialize all days of the year with 0
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      contributions[dateKey] = {
        date: dateKey,
        count: 0,
        interviews: 0,
        videos: 0,
        topics: new Set()
      };
    }

    // Count interviews
    interviews.forEach(interview => {
      const dateKey = interview.createdAt.toISOString().split('T')[0];
      if (contributions[dateKey]) {
        contributions[dateKey].interviews++;
        contributions[dateKey].count++;
        if (interview.topic) {
          contributions[dateKey].topics.add(interview.topic);
        }
      }
    });

    // Count videos
    videos.forEach(video => {
      const dateKey = video.createdAt.toISOString().split('T')[0];
      if (contributions[dateKey]) {
        contributions[dateKey].videos++;
        contributions[dateKey].count++;
      }
    });

    // Convert topics Set to Array and return
    const result = Object.values(contributions).map(day => ({
      ...day,
      topics: Array.from(day.topics)
    }));

    return result;
  } catch (error) {
    console.error('Error calculating user contributions:', error);
    return [];
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
