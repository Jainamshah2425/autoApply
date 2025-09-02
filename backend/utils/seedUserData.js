const User = require('../models/User');

// Utility function to seed sample contribution and stats data for a user
const seedUserProfileData = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found for seeding');
      return;
    }

    // Generate sample contribution data for the last 90 days
    const contributions = [];
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Randomly generate activity (about 60% chance of activity each day)
      if (Math.random() > 0.4) {
        const activityCount = Math.floor(Math.random() * 3) + 1; // 1-3 activities
        const activities = [];
        
        for (let j = 0; j < activityCount; j++) {
          const activityTypes = ['interview', 'practice', 'upload', 'review'];
          const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
          
          const descriptions = {
            interview: 'Completed mock interview session',
            practice: 'Practiced interview questions',
            upload: 'Uploaded resume or documents',
            review: 'Reviewed interview performance'
          };
          
          activities.push({
            type,
            description: descriptions[type],
            timestamp: new Date(date.getTime() + j * 60000) // Space out by minutes
          });
        }
        
        contributions.push({
          date: dateStr,
          count: activityCount,
          activities
        });
      }
    }

    // Generate sample stats
    const sampleStats = {
      totalInterviews: Math.floor(Math.random() * 20) + 5,
      totalQuestions: Math.floor(Math.random() * 100) + 25,
      averageScore: Math.floor(Math.random() * 40) + 60, // 60-100%
      improvementRate: Math.floor(Math.random() * 20) + 5, // 5-25%
      totalVideoTime: Math.floor(Math.random() * 7200) + 1800, // 30min to 2.5hrs in seconds
      level: Math.floor(Math.random() * 5) + 1,
      experiencePoints: Math.floor(Math.random() * 800) + 200,
      nextLevelPoints: 1000,
      weeklyGoal: 5,
      weeklyProgress: Math.floor(Math.random() * 6),
      currentStreak: Math.floor(Math.random() * 14),
      longestStreak: Math.floor(Math.random() * 30) + 5,
      favoriteTopics: [
        { name: 'JavaScript', count: Math.floor(Math.random() * 15) + 5 },
        { name: 'React', count: Math.floor(Math.random() * 12) + 3 },
        { name: 'Node.js', count: Math.floor(Math.random() * 10) + 2 },
        { name: 'System Design', count: Math.floor(Math.random() * 8) + 1 }
      ],
      recentAchievements: [
        {
          name: 'First Interview',
          description: 'Completed your first mock interview',
          icon: '🌟',
          unlockedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        },
        {
          name: 'Question Master',
          description: 'Answered 50+ interview questions',
          icon: '🧠',
          unlockedAt: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000)
        }
      ],
      skillProgress: {
        'JavaScript': Math.floor(Math.random() * 40) + 60,
        'React': Math.floor(Math.random() * 30) + 50,
        'Node.js': Math.floor(Math.random() * 35) + 45,
        'System Design': Math.floor(Math.random() * 25) + 35
      }
    };

    // Update user with sample data
    user.contributions = contributions;
    user.stats = sampleStats;
    
    // Add some profile fields if missing
    if (!user.fullName) user.fullName = user.name;
    if (!user.username) user.username = user.email.split('@')[0];
    if (!user.bio) user.bio = 'Aspiring software engineer preparing for technical interviews';
    if (!user.professionalBackground) user.professionalBackground = 'Software Development';

    await user.save();
    console.log(`Sample data seeded for user: ${user.email}`);
    
    return { success: true, message: 'Sample data seeded successfully' };
  } catch (error) {
    console.error('Error seeding user data:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { seedUserProfileData };
