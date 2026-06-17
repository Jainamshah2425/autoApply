const User = require('../models/User');

async function seedUserProfileData(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const sampleContributions = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    sampleContributions.push({
      date: d.toISOString().split('T')[0],
      activities: [
        {
          type: 'interview_completed',
          description: 'Completed mock interview session',
          metadata: {
            questionsAnswered: 3,
            averageScore: 72 + (i % 5) * 3,
            duration: 600
          }
        }
      ]
    });
  }

  user.contributions = sampleContributions;
  user.stats = {
    ...user.stats,
    questionsAnswered: 42,
    averageScore: 78,
    totalPracticeTime: 120,
    interviewsCompleted: 14,
    level: 2,
    experiencePoints: 1400,
    currentStreak: 3,
    longestStreak: 7
  };
  await user.save();

  return {
    contributionsAdded: sampleContributions.length,
    stats: user.stats
  };
}

module.exports = { seedUserProfileData };
