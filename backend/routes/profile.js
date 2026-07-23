const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const { requireAuth, requireOwnUserId } = require('../middleware/auth');
const { getCanonicalStats } = require('../services/userStatsService');
const { getReadiness } = require('../services/readinessService');

router.use(requireAuth);

// Get user profile with comprehensive data
router.get('/profile/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user basic info
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const stats = await getUserStats(userId);

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
      settings
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const { userId } = req.params;

    // Explicit allowlist (matches routes/user.js's PUT /profile/:userId) —
    // req.body must never be written to the User doc wholesale, since that
    // would let a client set password/stats/contributions/settings/etc.
    const ALLOWED_PROFILE_FIELDS = [
      'fullName', 'username', 'bio', 'location', 'website',
      'professionalBackground', 'profilePicture', 'phone',
      'linkedIn', 'github', 'currentTitle', 'company'
    ];
    const updates = {};
    for (const key of ALLOWED_PROFILE_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

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
router.get('/stats/:userId', requireOwnUserId(), async (req, res) => {
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
router.put('/settings/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { settings } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        settings,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
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

// Helper function to calculate user statistics — single source of truth via
// userStatsService.getCanonicalStats (fixes a live bug: this used to average
// InterviewSession.overallScore, a schema field that's never written anywhere
// in the codebase, so averageScore/improvementRate here always silently
// reported 0 regardless of how well the user actually did).
async function getUserStats(userId) {
  const canonical = await getCanonicalStats(userId);

  // Favorite topics and weekly progress aren't part of the cross-feature
  // score consolidation — keep them as small, targeted queries here.
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [topicAgg, weeklyProgress] = await Promise.all([
    InterviewSession.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), topic: { $exists: true, $ne: null } } },
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    InterviewSession.countDocuments({ user: userId, createdAt: { $gte: weekStart } })
  ]);

  const favoriteTopics = topicAgg.map(t => ({ name: t._id, count: t.count }));

  const experiencePoints = canonical.interview.totalSessions * 100 + canonical.interview.totalQuestions * 10;
  const level = Math.floor(experiencePoints / 1000) + 1;

  return {
    totalInterviews: canonical.interview.totalSessions,
    totalQuestions: canonical.interview.totalQuestions,
    averageScore: canonical.interview.averageScore ? Math.round(canonical.interview.averageScore) : 0,
    improvementRate: 0, // trend-over-time tracking is a separate concern from this consolidation
    favoriteTopics,
    currentStreak: canonical.combined.currentStreak,
    level,
    experiencePoints,
    nextLevelPoints: level * 1000,
    weeklyGoal: 5,
    weeklyProgress,
    recentAchievements: [] // TODO: Implement achievements system
  };
}

// Composite readiness score across aptitude, interview, and resume-skill coverage.
router.get('/readiness/:userId', requireOwnUserId(), async (req, res) => {
  try {
    const readiness = await getReadiness(req.params.userId);
    res.json({ success: true, readiness });
  } catch (error) {
    console.error('Error computing readiness:', error);
    res.status(500).json({ error: 'Failed to compute readiness score' });
  }
});

module.exports = router;
