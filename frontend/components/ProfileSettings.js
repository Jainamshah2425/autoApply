'use client';
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
// Accept both `settings` and `profile` for backward compatibility.
const ProfileSettings = ({
  settings: settingsProp,
  profile,
  onSettingsUpdate,
  onUpdate,
  onDeleteAccount,
  loading = false
}) => {
  const settings = settingsProp || profile || {};
  const saveHandler = onSettingsUpdate || onUpdate || (() => {});
  const [localSettings, setLocalSettings] = useState({
    notifications: {
      emailNotifications: true,
      interviewReminders: true,
      achievementNotifications: true,
      weeklyReports: true,
      marketingEmails: false,
      ...(settings?.notifications || {})
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
      ...(settings?.account || {})
    }
  });

  const [activeSection, setActiveSection] = useState('notifications');
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
      notifications: { ...(settings?.notifications || {}) },
      goals: { ...(settings?.goals || {}) },
      account: { ...(settings?.account || {}) }
    });
    setHasChanges(false);
  };

  const sections = [
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-3">Email Notifications</h3>
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
                className="mt-1 accent-primary rounded"
              />
              <div>
                <div className="font-medium text-foreground">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGoalSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-3">Practice Goals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Weekly Interview Target
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={localSettings.goals.weeklyInterviewTarget}
              onChange={(e) => updateSetting('goals', 'weeklyInterviewTarget', parseInt(e.target.value))}
              className="w-full border border-border rounded-md px-3 py-2 bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Daily Practice (minutes)
            </label>
            <input
              type="number"
              min="10"
              max="180"
              value={localSettings.goals.dailyPracticeMinutes}
              onChange={(e) => updateSetting('goals', 'dailyPracticeMinutes', parseInt(e.target.value))}
              className="w-full border border-border rounded-md px-3 py-2 bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Career Goal</label>
        <textarea
          value={localSettings.goals.careerGoal}
          onChange={(e) => updateSetting('goals', 'careerGoal', e.target.value)}
          placeholder="Describe your career aspirations..."
          rows="3"
          className="w-full border border-border rounded-md px-3 py-2 bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        />
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-destructive mb-3">Danger Zone</h3>
        <div>
          <Button variant="destructive" className="w-full md:w-auto" onClick={onDeleteAccount}>
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'notifications':
        return renderNotificationSettings();
      case 'goals':
        return renderGoalSettings();
      case 'account':
        return renderAccountSettings();
      default:
        return renderNotificationSettings();
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-col md:flex-row">
        {/* Settings Navigation */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Settings</h2>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
            <h3 className="text-xl font-semibold text-foreground">
              {sections.find(s => s.id === activeSection)?.label} Settings
            </h3>
          </div>

          {renderSectionContent()}

          {/* Save/Reset Buttons */}
          {hasChanges && (
            <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row gap-3 md:justify-end">
              <Button 
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="w-full md:w-auto"
              >
                Reset Changes
              </Button>
              <Button 
                variant="default"
                onClick={handleSave}
                disabled={loading}
                className="w-full md:w-auto flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
