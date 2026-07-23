const mongoose = require('mongoose');
const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const LiveInterviewSession = require('../models/LiveInterviewSession');
const AptitudeAttempt = require('../models/AptitudeAttempt');
const Video = require('../models/Video');
const aptitudeService = require('./aptitudeService');
const { withRetry } = require('../utils/withRetry');

/**
 * Shared streak calculation from a user's contribution heatmap. Extracted so
 * syncUserStats and getCanonicalStats compute the exact same numbers instead
 * of two divergent implementations.
 */
function computeStreaksFromUser(user) {
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
        break;
      }
    }

    currentStreak = streak;
    longestStreak = Math.max(maxStreak, user.stats?.longestStreak || 0);
  }
  return { currentStreak, longestStreak };
}

/**
 * Sync user stats from interview sessions and video analysis
 * This should be called periodically or after major actions
 */
const syncUserStats = async (userId) => {
  try {
    let updatedStats;

    // Re-fetches the user fresh on every attempt so a retry (triggered by a
    // concurrent addActivity call winning the race) recomputes against the
    // latest state instead of overwriting it with stale baselines — see
    // models/User.js's optimisticConcurrency option.
    await withRetry(async () => {
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

    const previousAverage = user.stats?.averageScore || 0;
    const improvementRate = previousAverage > 0
      ? Number((((averageScore - previousAverage) / previousAverage) * 100).toFixed(1))
      : 0;

    // Calculate level from existing XP or estimate
    const currentXP = user.stats?.experiencePoints || user.stats?.xp || 0;
    const estimatedXP = (totalInterviews * 100) + (totalQuestions * 10); // Rough estimate
    const finalXP = Math.max(currentXP, estimatedXP);
    
    const level = Math.floor(finalXP / 1000) + 1;

    // Calculate streaks from contributions
    const { currentStreak, longestStreak } = computeStreaksFromUser(user);

    // Update user stats with real calculated values
    updatedStats = {
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
    });

    return updatedStats;
  } catch (error) {
    console.error('Error syncing user stats:', error);
    throw error;
  }
};

/**
 * Calculate weekly progress for all users
 * This should be run as a weekly cron job
 *
 * UNUSED as of 2026-07-23 — not wired to any cron or route (backend/cron/
 * only schedules dailyApply, refreshAptitudeQuestions, keepAlive).
 * HeatmapService.updateStatsForActivity already maintains
 * user.stats.weeklyProgress in real time, so this batch job is redundant
 * even if it were wired up. Kept for reference, not fixed further.
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
 *
 * UNUSED as of 2026-07-23 — no callers found anywhere in the codebase.
 * HeatmapService.addActivity (services/heatmapService.js) is the real,
 * actively-called version of this logic. Kept for reference, not fixed
 * further (it has the same lost-update race that HeatmapService.addActivity
 * was fixed for).
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

/**
 * Single source of truth for a user's cross-feature stats. Runs one
 * aggregation per collection (InterviewSession, LiveInterviewSession,
 * AptitudeAttempt) in parallel rather than one $unionWith pipeline: the three
 * collections use different field names for the user reference (`user` vs
 * `userId`) and different nested score paths, so each collection needs its
 * own $match/$group anyway — keeping them separate means one can return
 * empty (e.g. a brand-new user with no aptitude attempts) without affecting
 * the other two, and each pipeline stays small enough to unit-test and
 * explain on its own.
 *
 * NOTE: InterviewSession's top-level `overallScore` field is never written
 * anywhere in this codebase (only `sessionMetrics.averageScore` is) — do not
 * average on it, it will silently look like everyone scores 0.
 */
async function getCanonicalStats(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [interviewAgg, liveAgg, aptitudeAgg, weakTopics, user] = await Promise.all([
    InterviewSession.aggregate([
      { $match: { user: userObjectId } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageScore: { $avg: '$sessionMetrics.averageScore' },
          totalQuestions: { $sum: { $size: { $ifNull: ['$questions', []] } } },
          totalResponses: { $sum: { $size: { $ifNull: ['$responses', []] } } }
        }
      }
    ]),
    LiveInterviewSession.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageScore: { $avg: '$metrics.averageScore' },
          avgCommunication: { $avg: '$metrics.categoryScores.communication' },
          avgTechnical: { $avg: '$metrics.categoryScores.technical' },
          avgProblemSolving: { $avg: '$metrics.categoryScores.problemSolving' },
          avgConfidence: { $avg: '$metrics.categoryScores.confidence' },
          behavioralCount: { $sum: { $cond: [{ $eq: ['$mode', 'behavioral'] }, 1, 0] } },
          technicalCount: { $sum: { $cond: [{ $eq: ['$mode', 'technical'] }, 1, 0] } },
          codingCount: { $sum: { $cond: [{ $eq: ['$mode', 'coding'] }, 1, 0] } }
        }
      }
    ]),
    AptitudeAttempt.aggregate([
      { $match: { userId: userObjectId, status: 'completed' } },
      {
        $facet: {
          overall: [
            { $group: { _id: null, totalAttempts: { $sum: 1 }, averagePercentage: { $avg: '$percentage' } } }
          ],
          topics: [
            { $unwind: '$topicBreakdown' },
            {
              $group: {
                _id: '$topicBreakdown.topic',
                correct: { $sum: '$topicBreakdown.correct' },
                total: { $sum: '$topicBreakdown.total' }
              }
            }
          ]
        }
      }
    ]),
    aptitudeService.getWeakTopics(userId),
    User.findById(userId).select('contributions stats.longestStreak')
  ]);

  const interview = interviewAgg[0] || { totalSessions: 0, completedSessions: 0, averageScore: null, totalQuestions: 0, totalResponses: 0 };
  const live = liveAgg[0] || {
    totalSessions: 0, completedSessions: 0, averageScore: null,
    avgCommunication: null, avgTechnical: null, avgProblemSolving: null, avgConfidence: null,
    behavioralCount: 0, technicalCount: 0, codingCount: 0
  };
  const aptOverall = (aptitudeAgg[0]?.overall || [])[0] || { totalAttempts: 0, averagePercentage: null };
  const aptTopics = (aptitudeAgg[0]?.topics || []).map(t => ({
    topic: t._id,
    correct: t.correct,
    total: t.total,
    percentage: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
  }));

  const stats = {
    userId: String(userId),
    interview: {
      totalSessions: interview.totalSessions,
      completedSessions: interview.completedSessions,
      completionRate: interview.totalSessions > 0 ? Math.round((interview.completedSessions / interview.totalSessions) * 100) : 0,
      averageScore: interview.averageScore ?? null,
      totalQuestions: interview.totalQuestions,
      totalResponses: interview.totalResponses
    },
    liveInterview: {
      totalSessions: live.totalSessions,
      completedSessions: live.completedSessions,
      completionRate: live.totalSessions > 0 ? Math.round((live.completedSessions / live.totalSessions) * 100) : 0,
      averageScore: live.averageScore ?? null,
      categoryScores: {
        communication: live.avgCommunication ?? null,
        technical: live.avgTechnical ?? null,
        problemSolving: live.avgProblemSolving ?? null,
        confidence: live.avgConfidence ?? null
      },
      byMode: { behavioral: live.behavioralCount, technical: live.technicalCount, coding: live.codingCount }
    },
    aptitude: {
      totalAttempts: aptOverall.totalAttempts,
      completedAttempts: aptOverall.totalAttempts,
      averagePercentage: aptOverall.averagePercentage ?? null,
      topicBreakdown: aptTopics,
      weakTopics
    }
  };

  const totalPracticeSessions = stats.interview.totalSessions + stats.liveInterview.totalSessions + stats.aptitude.totalAttempts;
  const scoreSources = [stats.interview.averageScore, stats.liveInterview.averageScore].filter(s => typeof s === 'number');
  const overallAverageScore = scoreSources.length > 0
    ? Math.round((scoreSources.reduce((a, b) => a + b, 0) / scoreSources.length) * 10) / 10
    : null;

  const { currentStreak, longestStreak } = user ? computeStreaksFromUser(user) : { currentStreak: 0, longestStreak: 0 };

  stats.combined = {
    totalPracticeSessions,
    overallAverageScore,
    currentStreak,
    longestStreak
  };
  stats.computedAt = new Date().toISOString();

  return stats;
}

module.exports = {
  syncUserStats,
  calculateWeeklyProgress,
  addUserActivity,
  getCanonicalStats
};
