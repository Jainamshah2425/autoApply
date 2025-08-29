'use client';
import React from 'react';

const ProfileStats = ({ stats = {} }) => {
  const {
    totalInterviews = 0,
    totalQuestions = 0,
    averageScore = 0,
    improvementRate = 0,
    totalVideoTime = 0,
    favoriteTopics = [],
    recentAchievements = [],
    level = 1,
    experiencePoints = 0,
    nextLevelPoints = 1000,
    weeklyGoal = 5,
    weeklyProgress = 0,
    skillProgress = {}
  } = stats;

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getProgressPercentage = () => {
    return Math.min((experiencePoints / nextLevelPoints) * 100, 100);
  };

  const getWeeklyProgressPercentage = () => {
    return Math.min((weeklyProgress / weeklyGoal) * 100, 100);
  };

  const statCards = [
    {
      title: 'Total Interviews',
      value: totalInterviews,
      icon: '🎤',
      color: 'bg-blue-500',
      description: 'Mock interviews completed'
    },
    {
      title: 'Questions Answered',
      value: totalQuestions,
      icon: '❓',
      color: 'bg-green-500',
      description: 'Interview questions practiced'
    },
    // {
    //   title: 'Average Score',
    //   value: `${averageScore}%`,
    //   icon: '📊',
    //   color: 'bg-purple-500',
    //   description: 'Performance across all interviews'
    // },
    // {
    //   title: 'Practice Time',
    //   value: formatDuration(totalVideoTime),
    //   icon: '⏱️',
    //   color: 'bg-orange-500',
    //   description: 'Total video recording time'
    // }
  ];

  const achievementBadges = [
    { name: 'First Interview', icon: '🌟', unlocked: totalInterviews >= 1 },
    { name: 'Question Master', icon: '🧠', unlocked: totalQuestions >= 50 },
    { name: 'Consistent Learner', icon: '🔥', unlocked: stats.currentStreak >= 7 },
    { name: 'High Performer', icon: '🏆', unlocked: averageScore >= 80 },
    { name: 'Video Expert', icon: '🎥', unlocked: totalVideoTime >= 3600 },
    { name: 'Topic Explorer', icon: '🗺️', unlocked: favoriteTopics.length >= 5 }
  ];

  return (
    <div className="space-y-8">
      {/* Level Progress */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Level {level}</h2>
            <p className="text-gray-600">
              {experiencePoints}/{nextLevelPoints} XP
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl mb-1">🏅</div>
            <div className="text-sm text-gray-600">Experience</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>
        
        <p className="text-sm text-gray-600">
          {nextLevelPoints - experiencePoints} XP until level {level + 1}
        </p>
      </div>

      {/* Weekly Goal Progress */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Weekly Goal</h3>
            <p className="text-gray-600">
              {weeklyProgress}/{weeklyGoal} interviews completed
            </p>
          </div>
          <div className="text-2xl">🎯</div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${getWeeklyProgressPercentage()}%` }}
          ></div>
        </div>
        
        {weeklyProgress >= weeklyGoal && (
          <p className="text-sm text-green-600 font-medium">🎉 Weekly goal achieved!</p>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </div>
                <div className="text-xs text-gray-500">
                  {stat.description}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center text-white text-xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Skills Progress */}
      {Object.keys(skillProgress).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Skill Development
          </h3>
          <div className="space-y-4">
            {Object.entries(skillProgress).map(([skill, progress]) => (
              <div key={skill}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {skill.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className="text-sm text-gray-500">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievement Badges */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {achievementBadges.map((achievement, index) => (
            <div
              key={index}
              className={`text-center p-4 rounded-lg border-2 transition-all ${
                achievement.unlocked
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              <div className={`text-2xl mb-2 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                {achievement.icon}
              </div>
              <div className="text-xs font-medium">
                {achievement.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Favorite Topics */}
      {favoriteTopics.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Favorite Interview Topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {favoriteTopics.map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {topic.name} ({topic.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Achievements
          </h3>
          <div className="space-y-3">
            {recentAchievements.map((achievement, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{achievement.name}</div>
                  <div className="text-sm text-gray-600">{achievement.description}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(achievement.unlockedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileStats;



