const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Service for efficiently managing heatmap and activity tracking
 */
class HeatmapService {
  
  /**
   * Add activity to user's heatmap and update related stats
   */
  static async addActivity(userId, activityType, details = {}) {
    try {
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const user = await User.findById(userObjectId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Create activity object
      const activity = {
        type: activityType,
        description: details.description || `${activityType} activity`,
        timestamp: new Date(),
        metadata: details.metadata || {}
      };

      // Find or create today's contribution
      const existingContributionIndex = user.contributions.findIndex(c => c.date === today);
      
      if (existingContributionIndex >= 0) {
        user.contributions[existingContributionIndex].count += 1;
        user.contributions[existingContributionIndex].activities.push(activity);
      } else {
        user.contributions.push({
          date: today,
          count: 1,
          activities: [activity]
        });
      }

      // Update stats based on activity type
      await this.updateStatsForActivity(user, activityType, details);
      
      // Update streaks
      await this.updateStreaks(user, today, existingContributionIndex === -1);
      
      await user.save();
      
      console.log(`✅ Activity "${activityType}" added to heatmap for user ${userId}`);
      
      return {
        success: true,
        contributionAdded: true,
        newContribution: existingContributionIndex === -1,
        date: today,
        activity: activity
      };
      
    } catch (error) {
      console.error('❌ Failed to add activity to heatmap:', error);
      throw error;
    }
  }

  /**
   * Update user stats based on activity type
   */
  static async updateStatsForActivity(user, activityType, details) {
    if (!user.stats) user.stats = {};

    switch (activityType) {
      case 'interview_completed':
        // Track interviews completed
        user.stats.totalInterviews = (user.stats.totalInterviews || 0) + 1;
        user.stats.interviewsCompleted = user.stats.totalInterviews; // Alias for consistency
        
        // Track questions answered
        const questionsAnswered = details.questionsAnswered || details.metadata?.questionsAnswered || 0;
        user.stats.totalQuestions = (user.stats.totalQuestions || 0) + questionsAnswered;
        user.stats.questionsAnswered = user.stats.totalQuestions; // Total questions answered
        
        // Track practice time (convert seconds to minutes)
        const sessionDuration = details.metadata?.duration || 0;
        user.stats.totalPracticeTime = (user.stats.totalPracticeTime || 0) + Math.round(sessionDuration / 60);
        
        // Calculate and update average score
        const sessionScore = details.averageScore || details.metadata?.averageScore || 0;
        if (sessionScore > 0) {
          const totalSessions = user.stats.totalInterviews;
          const currentAvgScore = user.stats.averageScore || 0;
          
          // Weighted average calculation
          user.stats.averageScore = Number(
            ((currentAvgScore * (totalSessions - 1)) + sessionScore) / totalSessions
          ).toFixed(1);
        }
        
        // Calculate improvement rate (based on recent performance trends)
        await this.calculateImprovementRate(user, sessionScore);
        
        // Calculate XP with bonuses
        const baseXP = 50;
        const questionBonus = questionsAnswered * 5; // 5 XP per question
        const completionBonus = Math.floor((details.completionRate || 0) * 2); // Up to 200 XP for 100% completion
        const scoreBonus = Math.floor(sessionScore * 2); // Up to 200 XP for perfect score
        const totalXP = baseXP + questionBonus + completionBonus + scoreBonus;
        
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + totalXP;
        user.stats.xp = user.stats.experiencePoints; // Alias for consistency
        user.stats.weeklyProgress = (user.stats.weeklyProgress || 0) + 1;
        
        this.checkLevelProgression(user);
        
        console.log(`📊 Updated stats for interview completion:
          - Questions: +${questionsAnswered} (Total: ${user.stats.questionsAnswered})
          - Practice Time: +${Math.round(sessionDuration / 60)}min (Total: ${user.stats.totalPracticeTime}min)
          - Average Score: ${user.stats.averageScore}% (Session: ${sessionScore}%)
          - XP: +${totalXP} (Total: ${user.stats.experiencePoints})`);
        break;
        
      case 'video_upload':
        // Track individual video uploads
        user.stats.totalQuestions = (user.stats.totalQuestions || 0) + 1;
        user.stats.questionsAnswered = user.stats.totalQuestions;
        
        // Track video recording time
        const videoDuration = parseInt(details.metadata?.duration || 0);
        user.stats.totalVideoTime = (user.stats.totalVideoTime || 0) + videoDuration;
        user.stats.totalPracticeTime = (user.stats.totalPracticeTime || 0) + Math.round(videoDuration / 60);
        
        // XP for video practice
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 25;
        user.stats.xp = user.stats.experiencePoints;
        
        console.log(`📹 Updated stats for video upload:
          - Questions: +1 (Total: ${user.stats.questionsAnswered})
          - Practice Time: +${Math.round(videoDuration / 60)}min (Total: ${user.stats.totalPracticeTime}min)`);
        break;
        
      case 'resume_upload':
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 10;
        user.stats.xp = user.stats.experiencePoints;
        break;
        
      default:
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 5;
        user.stats.xp = user.stats.experiencePoints;
    }
  }

  /**
   * Calculate improvement rate based on recent performance
   */
  static async calculateImprovementRate(user, currentScore) {
    if (!user.contributions || user.contributions.length < 2) {
      user.stats.improvementRate = 0;
      return;
    }

    // Get last 5 interview sessions to calculate trend
    const recentInterviews = user.contributions
      .filter(c => c.activities.some(a => a.type === 'interview_completed'))
      .slice(-5)
      .map(c => {
        const interview = c.activities.find(a => a.type === 'interview_completed');
        return interview.metadata?.averageScore || 0;
      })
      .filter(score => score > 0);

    if (recentInterviews.length >= 2) {
      const firstScore = recentInterviews[0];
      const lastScore = recentInterviews[recentInterviews.length - 1];
      
      // Calculate percentage improvement
      const improvement = ((lastScore - firstScore) / firstScore) * 100;
      user.stats.improvementRate = Number(Math.max(-100, Math.min(100, improvement))).toFixed(1);
    } else {
      user.stats.improvementRate = 0;
    }
  }

  /**
   * Check and handle level progression
   */
  static checkLevelProgression(user) {
    const currentLevel = user.stats.level || 1;
    const currentXP = user.stats.experiencePoints || 0;
    const nextLevelXP = currentLevel * 1000;
    
    if (currentXP >= nextLevelXP) {
      user.stats.level = currentLevel + 1;
      user.stats.nextLevelPoints = (currentLevel + 1) * 1000;
      
      // Add achievement
      if (!user.stats.recentAchievements) user.stats.recentAchievements = [];
      user.stats.recentAchievements.unshift({
        name: `Level ${user.stats.level} Achieved!`,
        description: `Reached level ${user.stats.level} through consistent practice`,
        icon: '🏆',
        unlockedAt: new Date()
      });
      
      // Keep only last 5 achievements
      user.stats.recentAchievements = user.stats.recentAchievements.slice(0, 5);
      
      console.log(`🎉 User leveled up to level ${user.stats.level}!`);
    }
  }

  /**
   * Update user streaks
   */
  static async updateStreaks(user, today, isNewContribution) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const hasYesterdayActivity = user.contributions.some(c => c.date === yesterdayStr && c.count > 0);
    const hasTodayActivity = user.contributions.some(c => c.date === today && c.count > 0);
    
    if (hasTodayActivity && isNewContribution) {
      if (hasYesterdayActivity || (user.stats.currentStreak || 0) === 0) {
        user.stats.currentStreak = (user.stats.currentStreak || 0) + 1;
      } else {
        user.stats.currentStreak = 1;
      }
      user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, user.stats.currentStreak);
    }
  }

  /**
   * Get user's heatmap data for a date range
   */
  static async getHeatmapData(userId, startDate, endDate) {
    try {
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const user = await User.findById(userObjectId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      
      const filteredContributions = user.contributions.filter(c => 
        c.date >= start && c.date <= end
      );

      return filteredContributions;
    } catch (error) {
      console.error('❌ Failed to get heatmap data:', error);
      throw error;
    }
  }

  /**
   * Bulk update activities (for migration or sync purposes)
   */
  static async bulkUpdateActivities(userId, activities) {
    try {
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const user = await User.findById(userObjectId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      for (const activity of activities) {
        await this.addActivity(userId, activity.type, activity.details);
      }
      
      return { success: true, activitiesProcessed: activities.length };
    } catch (error) {
      console.error('❌ Failed to bulk update activities:', error);
      throw error;
    }
  }
}

module.exports = HeatmapService;
