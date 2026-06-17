'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Header from '../../components/header';
import ContributionHeatmap from '../../components/ContributionHeatmap';
import ProfileStats from '../../components/ProfileStats';
import ProfileSettings from '../../components/ProfileSettings';
import { Button } from "@/components/ui/button";
import { ErrorMessage } from '@/components/ui/error-message';
import { BarChart3, Flame, Trophy, Settings, Loader2, Construction } from 'lucide-react';

import { api } from '@/lib/api';

// Define navigation tabs outside component to prevent re-creation on each render
const navigationTabs = [
  { id: 'overview', name: 'Overview', icon: BarChart3 },
  { id: 'contributions', name: 'Activity', icon: Flame },
  { id: 'achievements', name: 'Achievements', icon: Trophy },
  { id: 'settings', name: 'Settings', icon: Settings }
];

// Define date formatting options to prevent re-creation on each render
const dateFormatOptions = { 
  year: 'numeric', 
  month: 'long' 
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [contributionData, setContributionData] = useState([]);
  const [profileStats, setProfileStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('year'); // year, 6months, 3months
  const [privacySettings, setPrivacySettings] = useState({
    showEmail: true,
    showLocation: true,
    showSocialLinks: true,
    showStats: true,
    showContributions: true
  });

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Define useCallback functions first to prevent "Cannot access before initialization" error
  const loadUserProfile = useCallback(async () => {
    try {
      setError(null); // Clear any previous errors
      console.log('Loading user profile for:', session.user.email);
      
      const response = await api.get(`/api/user/by-email/${session.user.email}`);
      
      console.log('User profile loaded successfully:', response.data);
      setUserProfile(response.data);
    } catch (err) {
      console.error('Failed to load user profile:', err.response || err);
      
      let errorMessage = 'Failed to load user profile';
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout - please check your connection';
      } else if (err.response?.status === 404) {
        errorMessage = 'User not found. Please sign up first.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error - please try again later';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  const loadContributionData = useCallback(async () => {
    try {
      if (!userProfile?._id) return;
      
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '3months':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(endDate.getMonth() - 6);
          break;
        case 'year':
        default:
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      const response = await api.get(
        `/api/user/contributions/${userProfile._id}?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );
      setContributionData(response.data);
    } catch (err) {
      console.error('Failed to load contribution data:', err);
      setContributionData([]);
    }
  }, [userProfile?._id, timeRange]);

  const loadProfileStats = useCallback(async () => {
    try {
      if (!userProfile?._id) return;
      
      const response = await api.get(`/api/user/stats/${userProfile._id}`);
      setProfileStats(response.data);
    } catch (err) {
      console.error('Failed to load profile stats:', err);
      setProfileStats({});
    }
  }, [userProfile?._id]);

  // Helper function to toggle privacy settings
  const togglePrivacySetting = (key) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Load basic user profile once session email is available
  useEffect(() => {
    if (session?.user?.email) {
      loadUserProfile();
    }
  }, [session?.user?.email, loadUserProfile]);

  // Load contributions and stats when userProfile is ready or timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?._id) return;
      setLoading(true);
      try {
        await Promise.all([loadContributionData(), loadProfileStats()]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userProfile?._id, timeRange, loadContributionData, loadProfileStats]);

  // Real-time heatmap update listener
  useEffect(() => {
    const handleHeatmapUpdate = (event) => {
      console.log('🔥 Heatmap update detected:', event.detail);
      
      // Check if the update is for the current user
      if (event.detail.userId === userProfile?._id) {
        console.log('📊 Refreshing heatmap data for current user...');
        
        // Refresh contribution data and stats
        loadContributionData();
        loadProfileStats();
        
        // Optional: Show a notification
        // You could add a toast notification here
      }
    };

    // Only access browser APIs after component is mounted
    if (mounted && typeof window !== 'undefined') {
      // Listen for custom heatmap update events
      window.addEventListener('heatmapUpdated', handleHeatmapUpdate);
      
      // Also check localStorage for missed updates (in case page was loaded after update)
      const checkForMissedUpdates = () => {
        try {
          const storedUpdate = localStorage.getItem('heatmapUpdate');
          if (storedUpdate) {
            const updateEvent = JSON.parse(storedUpdate);
            
            // If update is recent (within last 5 minutes) and for current user
            const updateAge = Date.now() - updateEvent.timestamp;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (updateAge < fiveMinutes && updateEvent.userId === userProfile?._id) {
              console.log('📊 Found recent heatmap update, refreshing data...');
              loadContributionData();
              loadProfileStats();
              
              // Clear the stored update to prevent repeated refreshes
              localStorage.removeItem('heatmapUpdate');
            }
          }
        } catch (error) {
          console.warn('Failed to check for missed heatmap updates:', error);
        }
      };

      // Check for missed updates when component mounts
      if (userProfile?._id) {
        checkForMissedUpdates();
      }
    }

    // Cleanup
    return () => {
      if (mounted && typeof window !== 'undefined') {
        window.removeEventListener('heatmapUpdated', handleHeatmapUpdate);
      }
    };
  }, [mounted, userProfile?._id, loadContributionData, loadProfileStats]);

  // Auto-refresh data periodically (fallback for missed updates)
  useEffect(() => {
    if (!userProfile?._id) return;
    
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing profile data...');
      loadContributionData();
      loadProfileStats();
    }, 2 * 60 * 1000); // Refresh every 2 minutes
    
    return () => clearInterval(refreshInterval);
  }, [userProfile?._id, loadContributionData, loadProfileStats]);

  const updateProfile = async (updatedData) => {
    try {
      setLoading(true);
      await api.put(`/api/user/profile/${userProfile._id}`, updatedData);
      setUserProfile({ ...userProfile, ...updatedData });
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const updatePrivacySettings = async (settings) => {
    try {
      await api.put(`/api/user/privacy/${userProfile._id}`, settings);
      setPrivacySettings(settings);
    } catch (err) {
      console.error('Failed to update privacy settings:', err);
      setError('Failed to update privacy settings');
    }
  };

  // While auth status is loading, avoid flicker
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="bg-card rounded-xl border border-border p-8">
              <div className="flex items-center space-x-6">
                <div className="w-32 h-32 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            </div>
            <div className="mt-8 bg-card rounded-xl border border-border p-6">
              <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
              <div className="h-48 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="bg-card rounded-xl border border-border p-8">
              <div className="flex items-center space-x-6">
                <div className="w-32 h-32 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            </div>
            <div className="mt-8 bg-card rounded-xl border border-border p-6">
              <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
              <div className="h-48 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Please sign in to view your profile
          </h1>
          <p className="text-muted-foreground">
            You need to be logged in to access your profile page.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state until component is mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-4 mb-4">
          <ErrorMessage title="Error" message={error} />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-card rounded-xl border border-border p-8 mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-6 lg:space-y-0 lg:space-x-8">
            {/* Profile Picture */}
            <div className="relative">
              <Image
                src={userProfile?.profilePicture || session?.user?.image || '/default-avatar.svg'}
                alt="Profile Picture"
                width={128}
                height={128}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {profileStats.level || 1}
                </span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {userProfile?.fullName || session?.user?.name || 'User'}
                  </h1>
                  <p className="text-lg text-muted-foreground mb-2">
                    @{userProfile?.username || userProfile?.email?.split('@')[0]}
                  </p>
                  {privacySettings.showEmail && (
                    <p className="text-muted-foreground">
                      {userProfile?.email || session?.user?.email}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-3 mt-4 sm:mt-0">
                  <Button
                    variant="default"
                    onClick={() => setActiveTab('settings')}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setActiveTab('privacy')}
                  >
                    Privacy
                  </Button>
                </div>
              </div>

              {/* Bio */}
              {userProfile?.bio && (
                <p className="text-muted-foreground mt-4 max-w-2xl">
                  {userProfile.bio}
                </p>
              )}

              {/* Location & Links */}
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-muted-foreground">
                {privacySettings.showLocation && userProfile?.location && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {userProfile.location}
                  </div>
                )}
                
                {userProfile?.website && (
                  <a
                    href={userProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-primary"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-2a1 1 0 10-2 0v2H5V7h2a1 1 0 000-2H5z" />
                    </svg>
                    Website
                  </a>
                )}

                <div className="text-muted-foreground">
                  Joined {new Date(userProfile?.createdAt || Date.now()).toLocaleDateString('en-US', dateFormatOptions)}
                </div>
              </div>

              {/* Professional Background */}
              {userProfile?.professionalBackground && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Professional Background</h3>
                  <p className="text-muted-foreground">{userProfile.professionalBackground}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-card rounded-xl border border-border mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex">
              {navigationTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <>
              {privacySettings.showStats && (
                <ProfileStats stats={profileStats} />
              )}
              
              {privacySettings.showContributions && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground">Activity Overview</h2>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-colors"
                    >
                      <option value="3months">Last 3 months</option>
                      <option value="6months">Last 6 months</option>
                      <option value="year">Last year</option>
                    </select>
                  </div>
                  <ContributionHeatmap 
                    data={contributionData} 
                    timeRange={timeRange}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'contributions' && privacySettings.showContributions && (
            <ContributionHeatmap 
              data={contributionData} 
              timeRange={timeRange}
              detailed={true}
            />
          )}

          {activeTab === 'achievements' && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Achievements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="text-center text-muted-foreground flex flex-col items-center gap-2 py-8">
                  <Construction className="w-6 h-6" />
                  <span>Achievements system coming soon</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <ProfileSettings 
              profile={userProfile}
              onUpdate={updateProfile}
            />
          )}

          {activeTab === 'privacy' && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Privacy Settings</h2>
              <div className="space-y-4">
                {Object.entries(privacySettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </label>
                    <button
                      onClick={() => togglePrivacySetting(key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="default"
                onClick={() => updatePrivacySettings(privacySettings)}
                className="mt-6"
              >
                Save Privacy Settings
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

