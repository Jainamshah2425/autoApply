'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../../components/header';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function InterviewHistoryPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (session?.user?.email) {
      console.log('Fetching user ID for email:', session.user.email);
      axios
        .get(`${API_URL}/api/user/by-email/${session.user.email}`)
        .then((res) => {
          console.log('User API response:', res.data);
          // Fix: Use _id instead of userId
          const fetchedUserId = res.data._id || res.data.userId;
          setUserId(fetchedUserId);
          console.log('Setting userId to:', fetchedUserId);
        })
        .catch((err) => {
          console.error('Failed to load user', err);
          setError('Failed to load user profile. Please try refreshing the page.');
          setLoading(false);
        });
    }
  }, [session]);

  useEffect(() => {
    if (userId) {
      console.log('Fetching sessions for userId:', userId);
      // Fix: Use correct API endpoint
      axios
        .get(`${API_URL}/api/interview/sessions/user/${userId}`)
        .then((res) => {
          console.log('Sessions API response:', res.data);
          // The backend returns sessions directly in res.data.sessions
          setSessions(res.data.sessions || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load sessions', err);
          setError('Failed to load interview sessions. Please try again.');
          setLoading(false);
        });
    }
  }, [userId]);

  return (
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Interview History</h2>
          <Link 
            href="/interview" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Interview
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading your interview history...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews yet</h3>
            <p className="text-gray-500 mb-6">Start your first mock interview to practice and get feedback.</p>
            <Link 
              href="/interview" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              Start Interview
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => (
              <div key={session._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Interview Session
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {new Date(session.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      session.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : session.status === 'in-progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status || 'Draft'}
                    </span>
                  </div>
                  
                  {session.jobDescription && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {session.jobDescription.substring(0, 200)}
                      {session.jobDescription.length > 200 && '...'}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {session.questions?.length || 0} Questions
                      </span>
                      {session.responses && (
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {session.responses.length} Responses
                        </span>
                      )}
                    </div>
                    
                    <Link 
                      href={`/interview/history/${session._id}`} 
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Details & Analysis
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
