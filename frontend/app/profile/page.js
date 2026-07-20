'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Header from '../../components/header';
import ProfileSettings from '../../components/ProfileSettings';
import { Button } from "@/components/ui/button";
import { ErrorMessage } from '@/components/ui/error-message';
import { BarChart3, Trophy, Settings, Construction, LogOut, Trash2, AlertTriangle } from 'lucide-react';

import { api } from '@/lib/api';

// Define navigation tabs outside component to prevent re-creation on each render
const navigationTabs = [
  { id: 'overview', name: 'Overview', icon: BarChart3 },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Load basic user profile once session email is available
  useEffect(() => {
    if (session?.user?.email) {
      loadUserProfile();
    }
  }, [session?.user?.email, loadUserProfile]);

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

  const handleDeleteAccount = async () => {
    if (!userProfile?._id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/user/${userProfile._id}`);
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError('Failed to delete account. Please try again.');
      setDeleting(false);
      setConfirmingDelete(false);
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
              <div className="flex-1">
                <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
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
              <div className="flex-1">
                <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
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
                  <p className="text-muted-foreground">
                    {userProfile?.email || session?.user?.email}
                  </p>
                </div>

                <div className="flex space-x-3 mt-4 sm:mt-0">
                  <Button
                    variant="default"
                    onClick={() => setActiveTab('settings')}
                  >
                    Edit Profile
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
                {userProfile?.location && (
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
            <div className="bg-card rounded-xl border border-border p-6 max-w-md">
              <h2 className="text-xl font-bold text-foreground mb-1">Account</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {userProfile?.email || session?.user?.email}
              </p>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut className="w-4 h-4" /> Log out
                </Button>

                {!confirmingDelete ? (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="w-4 h-4" /> Delete account
                  </Button>
                ) : (
                  <div className="border border-destructive/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>This permanently deletes your account, resumes, interview history, and application records. This can&apos;t be undone.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete permanently'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
              onDeleteAccount={() => {
                setActiveTab('overview');
                setConfirmingDelete(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

