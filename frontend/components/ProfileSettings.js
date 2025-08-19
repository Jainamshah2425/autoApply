'use client';
import React, { useState } from 'react';

// Accept both `settings` and `profile` for backward compatibility.
const ProfileSettings = ({ 
  settings: settingsProp,
  profile,
  onSettingsUpdate,
  onUpdate,
  loading = false 
}) => {
  const settings = settingsProp || profile || {};
  const saveHandler = onSettingsUpdate || onUpdate || (() => {});
  const [localSettings, setLocalSettings] = useState({
    privacy: {
      showEmail: false,
      showPhone: false,
      showLinkedIn: true,
      showGitHub: true,
      showContributions: true,
      showStats: true,
      showAchievements: true,
      profileVisibility: 'public', // public, friends, private
      ...(settings?.privacy || {})
    },
    notifications: {
      emailNotifications: true,
      interviewReminders: true,
      achievementNotifications: true,
      weeklyReports: true,
      marketingEmails: false,
      ...(settings?.notifications || {})
    },
    preferences: {
      theme: 'system', // light, dark, system
      language: 'en',
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      autoPlayVideos: true,
      showTips: true,
      ...(settings?.preferences || {})
    },
    goals: {
      weeklyInterviewTarget: 5,
      dailyPracticeMinutes: 30,
      skillFocusAreas: [],
      careerGoal: '',
      targetCompanies: [],
      ...(settings?.goals || {})
    },
    account: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      dataRetention: 365,
      ...(settings?.account || {})
    }
  });

  const [activeSection, setActiveSection] = useState('privacy');
  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = (section, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await saveHandler(localSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    setLocalSettings({
      privacy: { ...(settings?.privacy || {}) },
      notifications: { ...(settings?.notifications || {}) },
      preferences: { ...(settings?.preferences || {}) },
      goals: { ...(settings?.goals || {}) },
      account: { ...(settings?.account || {}) }
    });
    setHasChanges(false);
  };

  const sections = [
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Profile Visibility</h3>
        <div className="space-y-3">
          {[
            { value: 'public', label: 'Public', description: 'Anyone can view your profile' },
            { value: 'friends', label: 'Friends Only', description: 'Only your connections can view' },
            { value: 'private', label: 'Private', description: 'Only you can view your profile' }
          ].map((option) => (
            <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="profileVisibility"
                value={option.value}
                checked={localSettings.privacy.profileVisibility === option.value}
                onChange={(e) => updateSetting('privacy', 'profileVisibility', e.target.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Information Visibility</h3>
        <div className="space-y-3">
          {[
            { key: 'showEmail', label: 'Email Address' },
            { key: 'showPhone', label: 'Phone Number' },
            { key: 'showLinkedIn', label: 'LinkedIn Profile' },
            { key: 'showGitHub', label: 'GitHub Profile' },
            { key: 'showContributions', label: 'Contribution Heatmap' },
            { key: 'showStats', label: 'Statistics' },
            { key: 'showAchievements', label: 'Achievements' }
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-900">{item.label}</span>
              <input
                type="checkbox"
                checked={localSettings.privacy[item.key] || false}
                onChange={(e) => updateSetting('privacy', item.key, e.target.checked)}
                className="text-blue-600 focus:ring-blue-500 rounded"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Email Notifications</h3>
        <div className="space-y-3">
          {[
            { key: 'emailNotifications', label: 'General Email Notifications', description: 'Important updates and announcements' },
            { key: 'interviewReminders', label: 'Interview Reminders', description: 'Scheduled interview notifications' },
            { key: 'achievementNotifications', label: 'Achievement Notifications', description: 'When you unlock new achievements' },
            { key: 'weeklyReports', label: 'Weekly Progress Reports', description: 'Summary of your weekly activity' },
            { key: 'marketingEmails', label: 'Marketing Emails', description: 'Product updates and promotions' }
          ].map((item) => (
            <label key={item.key} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.notifications[item.key] || false}
                onChange={(e) => updateSetting('notifications', item.key, e.target.checked)}
                className="mt-1 text-blue-600 focus:ring-blue-500 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">{item.label}</div>
                <div className="text-sm text-gray-600">{item.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Appearance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <select
              value={localSettings.preferences.theme}
              onChange={(e) => updateSetting('preferences', 'theme', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={localSettings.preferences.language}
              onChange={(e) => updateSetting('preferences', 'language', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Display Options</h3>
        <div className="space-y-3">
          {[
            { key: 'autoPlayVideos', label: 'Auto-play videos' },
            { key: 'showTips', label: 'Show helpful tips' }
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-900">{item.label}</span>
              <input
                type="checkbox"
                checked={localSettings.preferences[item.key] || false}
                onChange={(e) => updateSetting('preferences', item.key, e.target.checked)}
                className="text-blue-600 focus:ring-blue-500 rounded"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGoalSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Practice Goals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weekly Interview Target
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={localSettings.goals.weeklyInterviewTarget}
              onChange={(e) => updateSetting('goals', 'weeklyInterviewTarget', parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily Practice (minutes)
            </label>
            <input
              type="number"
              min="10"
              max="180"
              value={localSettings.goals.dailyPracticeMinutes}
              onChange={(e) => updateSetting('goals', 'dailyPracticeMinutes', parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Career Goal</label>
        <textarea
          value={localSettings.goals.careerGoal}
          onChange={(e) => updateSetting('goals', 'careerGoal', e.target.value)}
          placeholder="Describe your career aspirations..."
          rows="3"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Security</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-gray-900">Two-Factor Authentication</span>
              <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.account.twoFactorEnabled || false}
              onChange={(e) => updateSetting('account', 'twoFactorEnabled', e.target.checked)}
              className="text-blue-600 focus:ring-blue-500 rounded"
            />
          </label>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Timeout (minutes)
            </label>
            <select
              value={localSettings.account.sessionTimeout}
              onChange={(e) => updateSetting('account', 'sessionTimeout', parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Data Management</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data Retention Period (days)
          </label>
          <select
            value={localSettings.account.dataRetention}
            onChange={(e) => updateSetting('account', 'dataRetention', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
            <option value={-1}>Forever</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-red-600 mb-3">Danger Zone</h3>
        <div className="space-y-3">
          <button className="w-full md:w-auto px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
            Export My Data
          </button>
          <button className="w-full md:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ml-0 md:ml-3">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'privacy':
        return renderPrivacySettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'preferences':
        return renderPreferences();
      case 'goals':
        return renderGoalSettings();
      case 'account':
        return renderAccountSettings();
      default:
        return renderPrivacySettings();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row">
        {/* Settings Navigation */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {sections.find(s => s.id === activeSection)?.label} Settings
            </h3>
          </div>

          {renderSectionContent()}

          {/* Save/Reset Buttons */}
          {hasChanges && (
            <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col md:flex-row gap-3 md:justify-end">
              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Reset Changes
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
