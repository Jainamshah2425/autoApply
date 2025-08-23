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

    // Calculate stats from contributions (most accurate method)
    let totalQuestions = 0;
    let totalPracticeTime = 0; // in minutes
    let totalInterviews = 0;
    let totalScores = [];
    let totalVideoTime = 0; // in seconds
    let totalXP = 0;

    // Process all contributions to calculate real stats
    if (user.contributions && user.contributions.length > 0) {
      user.contributions.forEach(contribution => {
        if (contribution.activities) {
          contribution.activities.forEach(activity => {
            switch (activity.type) {
              case 'interview_completed':
                totalInterviews++;
                const questionsInSession = activity.metadata?.questionsAnswered || 0;
                const sessionScore = activity.metadata?.averageScore || 0;
                const sessionDuration = activity.metadata?.duration || 0;
                
                totalQuestions += questionsInSession;
                totalPracticeTime += Math.round(sessionDuration / 60); // Convert to minutes
                
                if (sessionScore > 0) {
                  totalScores.push(sessionScore);
                }
                break;
                
              case 'video_upload':
                totalQuestions++;
                const videoDuration = activity.metadata?.duration || 0;
                totalVideoTime += videoDuration;
                totalPracticeTime += Math.round(videoDuration / 60);
                break;
            }
          });
        }
      });
    }

    // Fallback to database queries if contributions are incomplete
    if (totalInterviews === 0 || totalQuestions === 0) {
      console.log('📊 Using database fallback for stats calculation...');
      
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
      
      // Update from database if higher than calculated
      totalInterviews = Math.max(totalInterviews, sessions.completedSessions || 0);
      totalQuestions = Math.max(totalQuestions, (sessions.totalQuestions || 0) + (videos.totalVideos || 0));
      totalPracticeTime = Math.max(totalPracticeTime, Math.round((videos.totalDuration || 0) / 60));
      
      if (sessions.averageScore && totalScores.length === 0) {
        totalScores.push(sessions.averageScore);
      }
    }

    // Calculate derived stats
    const averageScore = totalScores.length > 0 
      ? Number((totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1))
      : 0;

    // Calculate level from existing XP or estimate
    const currentXP = user.stats?.experiencePoints || user.stats?.xp || 0;
    const estimatedXP = (totalInterviews * 100) + (totalQuestions * 10); // Rough estimate
    const finalXP = Math.max(currentXP, estimatedXP);
    
    const level = Math.floor(finalXP / 1000) + 1;

    // Calculate streaks from contributions
    let currentStreak = 0;
    let longestStreak = 0;
    if (user.contributions && user.contributions.length > 0) {
      const sortedContributions = user.contributions
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      let streak = 0;
      let maxStreak = 0;
      const today = new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < sortedContributions.length; i++) {
        const contributionDate = sortedContributions[i].date;
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        
        if (contributionDate === expectedDateStr) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          if (i === 0 && contributionDate !== today) {
            // No activity today, current streak is 0
            currentStreak = 0;
          } else {
            currentStreak = i === 0 ? streak : 0;
          }
          break;
        }
      }
      
      currentStreak = streak;
      longestStreak = Math.max(maxStreak, user.stats?.longestStreak || 0);
    }

    // Update user stats with real calculated values
    const updatedStats = {
      ...user.stats,
      // Core metrics (what you requested)
      questionsAnswered: totalQuestions,
      averageScore: averageScore,
      totalPracticeTime: totalPracticeTime, // in minutes
      
      // Additional metrics for consistency
      interviewsCompleted: totalInterviews,
      totalInterviews: totalInterviews,
      level: level,
      experiencePoints: finalXP,
      xp: finalXP, // Alias
      improvementRate: improvementRate,
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      
      // Legacy/derived fields
      totalQuestions: totalQuestions, // Alias for questionsAnswered
      totalVideoTime: totalVideoTime, // in seconds
      
      // Calculated at sync time
      lastSyncedAt: new Date().toISOString(),
      weeklyProgress: user.stats?.weeklyProgress || 0
    };

    // Save updated stats
    user.stats = updatedStats;
    await user.save();

    console.log(`📊 Synced stats for user ${userId}:
      - Questions Answered: ${totalQuestions}
      - Average Score: ${averageScore}%
      - Practice Time: ${totalPracticeTime} minutes
      - Interviews Completed: ${totalInterviews}
      - Current Level: ${level}
      - Current Streak: ${currentStreak} days`);

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
