const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: String,
  phone: String,
  linkedIn: String,
  github: String,
  bio: String,
  location: String,
  profilePicture: String,
  currentTitle: String,
  company: String,
  lastActive: Date,
  resume: String,
  preferences: {
    jobTitles: [String],
    skills: [String],
    location: String,
    remoteOnly: Boolean,
  },
  settings: {
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showLinkedIn: { type: Boolean, default: true },
      showGitHub: { type: Boolean, default: true },
      showContributions: { type: Boolean, default: true },
      showStats: { type: Boolean, default: true },
      showAchievements: { type: Boolean, default: true },
      profileVisibility: { type: String, default: 'public' }
    },
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      interviewReminders: { type: Boolean, default: true },
      achievementNotifications: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false }
    },
    preferences: {
      theme: { type: String, default: 'system' },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'America/New_York' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      timeFormat: { type: String, default: '12h' },
      autoPlayVideos: { type: Boolean, default: true },
      showTips: { type: Boolean, default: true }
    },
    goals: {
      weeklyInterviewTarget: { type: Number, default: 5 },
      dailyPracticeMinutes: { type: Number, default: 30 },
      skillFocusAreas: [String],
      careerGoal: String,
      targetCompanies: [String]
    },
    account: {
      twoFactorEnabled: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 30 },
      dataRetention: { type: Number, default: 365 }
    }
  },
  gmailTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number,
  },
  // Profile enhancement fields
  fullName: String,
  username: String,
  website: String,
  professionalBackground: String,
  // Stats tracking fields
  stats: {
    totalInterviews: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    improvementRate: { type: Number, default: 0 },
    totalVideoTime: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    experiencePoints: { type: Number, default: 0 },
    nextLevelPoints: { type: Number, default: 1000 },
    weeklyGoal: { type: Number, default: 5 },
    weeklyProgress: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    favoriteTopics: [{
      name: String,
      count: Number
    }],
    recentAchievements: [{
      name: String,
      description: String,
      icon: String,
      unlockedAt: Date
    }],
    skillProgress: {
      type: Map,
      of: Number
    }
  },
  // Activity tracking for heatmap
  contributions: [{
    date: { type: String, required: true }, // YYYY-MM-DD format
    count: { type: Number, default: 1 },
    activities: [{
      type: { type: String, required: true }, // interview, practice, upload, etc.
      description: String,
      timestamp: { type: Date, default: Date.now }
    }]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
