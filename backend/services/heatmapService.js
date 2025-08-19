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
        user.stats.totalInterviews = (user.stats.totalInterviews || 0) + 1;
        user.stats.totalQuestions = (user.stats.totalQuestions || 0) + (details.questionsAnswered || 0);
        
        // Calculate XP with bonuses
        const baseXP = 50;
        const completionBonus = Math.floor((details.completionRate || 0) / 10);
        const scoreBonus = Math.floor((details.averageScore || 0) / 10);
        const totalXP = baseXP + completionBonus + scoreBonus;
        
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + totalXP;
        user.stats.weeklyProgress = (user.stats.weeklyProgress || 0) + 1;
        
        // Update average score
        if (details.averageScore) {
          const totalSessions = user.stats.totalInterviews;
          const currentAvg = user.stats.averageScore || 0;
          user.stats.averageScore = ((currentAvg * (totalSessions - 1)) + details.averageScore) / totalSessions;
        }
        
        this.checkLevelProgression(user);
        break;
        
      case 'video_upload':
        user.stats.totalQuestions = (user.stats.totalQuestions || 0) + 1;
        user.stats.totalVideoTime = (user.stats.totalVideoTime || 0) + parseInt(details.metadata?.duration || 0);
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 25; // 25 XP per video upload
        break;
        
      case 'resume_upload':
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 10; // 10 XP for resume upload
        break;
        
      default:
        user.stats.experiencePoints = (user.stats.experiencePoints || 0) + 5;
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
