const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const Video = require('../models/Video');

/**
 * Sync user stats from interview sessions and video analysis
 * This should be called periodically or after major actions
 */
const syncUserStats = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get interview session stats
    const sessionStats = await InterviewSession.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageScore: { $avg: '$overallScore' },
          totalQuestions: { $sum: { $size: '$questions' } }
        }
      }
    ]);

    // Get video stats
    const videoStats = await Video.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalVideos: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          averageConfidence: { $avg: '$analysis.confidence' },
          averageClarity: { $avg: '$analysis.clarity' },
          averageEyeContact: { $avg: '$analysis.eyeContact' },
          averageSpeakingRate: { $avg: '$analysis.speakingRate' }
        }
      }
    ]);

    const sessions = sessionStats[0] || {};
    const videos = videoStats[0] || {};

    // Calculate improvement rate (simplified - could be more sophisticated)
    const recentSessions = await InterviewSession.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    let improvementRate = 0;
    if (recentSessions.length >= 2) {
      const recent = recentSessions.slice(0, Math.floor(recentSessions.length / 2));
      const older = recentSessions.slice(Math.floor(recentSessions.length / 2));
      
      const recentAvg = recent.reduce((sum, s) => sum + (s.overallScore || 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, s) => sum + (s.overallScore || 0), 0) / older.length;
      
      improvementRate = recentAvg - olderAvg;
    }

    // Calculate level based on experience points
    const currentXP = user.stats?.experiencePoints || 0;
    const level = Math.floor(currentXP / 1000) + 1; // 1000 XP per level
    const nextLevelPoints = level * 1000;

    // Update user stats
    const updatedStats = {
      ...user.stats,
      totalInterviews: sessions.completedSessions || user.stats?.totalInterviews || 0,
      totalQuestions: sessions.totalQuestions || user.stats?.totalQuestions || 0,
      averageScore: Math.round(sessions.averageScore || user.stats?.averageScore || 0),
      improvementRate: Math.round(improvementRate),
      totalVideoTime: videos.totalDuration || user.stats?.totalVideoTime || 0,
      level,
      nextLevelPoints,
      behavioralScores: {
        eyeContact: Math.round(videos.averageEyeContact || user.stats?.behavioralScores?.eyeContact || 0),
        speakingRate: Math.round(videos.averageSpeakingRate || user.stats?.behavioralScores?.speakingRate || 0),
        confidence: Math.round(videos.averageConfidence || user.stats?.behavioralScores?.confidence || 0),
        clarity: Math.round(videos.averageClarity || user.stats?.behavioralScores?.clarity || 0)
      }
    };

    user.stats = updatedStats;
    await user.save();

    return updatedStats;
  } catch (error) {
    console.error('Error syncing user stats:', error);
    throw error;
  }
};

/**
 * Calculate weekly progress for all users
 * This should be run as a weekly cron job
 */
const calculateWeeklyProgress = async () => {
  try {
    const users = await User.find({});
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      const weeklyContributions = user.contributions.filter(c => 
        c.date >= oneWeekAgoStr && c.date <= today
      );
      
      const weeklyInterviews = weeklyContributions.reduce((sum, c) => 
        sum + c.activities.filter(a => a.type === 'interview_completed').length, 0
      );

      if (!user.stats) user.stats = {};
      user.stats.weeklyProgress = weeklyInterviews;
      
      await user.save();
    }

    console.log(`Updated weekly progress for ${users.length} users`);
  } catch (error) {
    console.error('Error calculating weekly progress:', error);
  }
};

/**
 * Add activity to user's contribution heatmap
 */
const addUserActivity = async (userId, activityType, description) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const existingContribution = user.contributions.find(c => c.date === today);
    
    if (existingContribution) {
      existingContribution.count += 1;
      existingContribution.activities.push({
        type: activityType,
        description,
        timestamp: new Date()
      });
    } else {
      user.contributions.push({
        date: today,
        count: 1,
        activities: [{
          type: activityType,
          description,
          timestamp: new Date()
        }]
      });
    }

    await user.save();
  } catch (error) {
    console.error('Error adding user activity:', error);
  }
};

module.exports = {
  syncUserStats,
  calculateWeeklyProgress,
  addUserActivity
};
