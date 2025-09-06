'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import axios from 'axios';
import Header from '../../components/header';
import ContributionHeatmap from '../../components/ContributionHeatmap';
import ProfileStats from '../../components/ProfileStats';
import ProfileSettings from '../../components/ProfileSettings';

// Use environment variable for API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://autoapply-xsj0.onrender.com';

// Define navigation tabs outside component to prevent re-creation on each render
const navigationTabs = [
  { id: 'overview', name: 'Overview', icon: '📊' },
  { id: 'contributions', name: 'Activity', icon: '🔥' },
  { id: 'achievements', name: 'Achievements', icon: '🏆' },
  { id: 'settings', name: 'Settings', icon: '⚙️' }
];

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
      
      const response = await axios.get(
        `${API_URL}/api/user/by-email/${session.user.email}`,
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
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

      const response = await axios.get(
        `${API_URL}/api/user/contributions/${userProfile._id}?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
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
      
      const response = await axios.get(
        `${API_URL}/api/user/stats/${userProfile._id}`
      );
      setProfileStats(response.data);
    } catch (err) {
      console.error('Failed to load profile stats:', err);
      setProfileStats({});
    }
  }, [userProfile?._id]);

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
      await axios.put(
        `${API_URL}/api/user/profile/${userProfile._id}`,
        updatedData
      );
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
      await axios.put(
        `${API_URL}/api/user/privacy/${userProfile._id}`,
        settings
      );
      setPrivacySettings(settings);
    } catch (err) {
      console.error('Failed to update privacy settings:', err);
      setError('Failed to update privacy settings');
    }
  };

  // While auth status is loading, avoid flicker
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center space-x-6">
                <div className="w-32 h-32 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                </div>
              </div>
            </div>
            <div className="mt-8 bg-white rounded-lg shadow-md p-6">
              <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
              <div className="h-48 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center space-x-6">
                <div className="w-32 h-32 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                </div>
              </div>
            </div>
            <div className="mt-8 bg-white rounded-lg shadow-md p-6">
              <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
              <div className="h-48 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Please sign in to view your profile
          </h1>
          <p className="text-gray-600">
            You need to be logged in to access your profile page.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state until component is mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
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
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {userProfile?.fullName || session?.user?.name || 'User'}
                  </h1>
                  <p className="text-lg text-gray-600 mb-2">
                    @{userProfile?.username || userProfile?.email?.split('@')[0]}
                  </p>
                  {privacySettings.showEmail && (
                    <p className="text-gray-500">
                      {userProfile?.email || session?.user?.email}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-3 mt-4 sm:mt-0">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => setActiveTab('privacy')}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Privacy
                  </button>
                </div>
              </div>

              {/* Bio */}
              {userProfile?.bio && (
                <p className="text-gray-700 mt-4 max-w-2xl">
                  {userProfile.bio}
                </p>
              )}

              {/* Location & Links */}
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-gray-600">
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
                    className="flex items-center hover:text-blue-600"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-2a1 1 0 10-2 0v2H5V7h2a1 1 0 000-2H5z" />
                    </svg>
                    Website
                  </a>
                )}

                <div className="text-gray-500">
                  Joined {new Date(userProfile?.createdAt || Date.now()).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </div>
              </div>

              {/* Professional Background */}
              {userProfile?.professionalBackground && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Professional Background</h3>
                  <p className="text-gray-600">{userProfile.professionalBackground}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              {navigationTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
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
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Activity Overview</h2>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Achievements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Achievement items will be populated based on user stats */}
                <div className="text-center text-gray-500">
                  🚧 Achievements system coming soon!
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Privacy Settings</h2>
              <div className="space-y-4">
                {Object.entries(privacySettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </label>
                    <button
                      onClick={() => setPrivacySettings({
                        ...privacySettings,
                        [key]: !value
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => updatePrivacySettings(privacySettings)}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Privacy Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

