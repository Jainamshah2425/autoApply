'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../../../components/header';
import SentimentDashboard from '../../../../components/SentimentDashboard';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SessionDetailPage() {
  const { data: session } = useSession();
  const [interviewSession, setInterviewSession] = useState(null);
  const [behavioralAnalysis, setBehavioralAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const params = useParams();
  const { sessionId } = params;

  useEffect(() => {
    if (sessionId) {
      console.log('Loading session details for:', sessionId);
      axios
        .get(`${API_URL}/api/interview/session/${sessionId}`)
        .then((res) => {
          console.log('Session data:', res.data);
          setInterviewSession(res.data.session || res.data);
          setLoading(false);
          
          // Try to load behavioral analysis data if available
          loadBehavioralAnalysis(sessionId);
        })
        .catch((err) => {
          console.error('Failed to load session', err);
          setError('Failed to load interview session. Please try again.');
          setLoading(false);
        });
    }
  }, [sessionId]);

  const loadBehavioralAnalysis = async (sessionId) => {
    setLoadingAnalysis(true);
    try {
      // Try to get behavioral analysis from FastAPI
      const response = await axios.get(`http://localhost:8000/api/interview/sentiment-dashboard/${sessionId}`);
      setBehavioralAnalysis(response.data.dashboard_data);
    } catch (error) {
      console.log('No behavioral analysis data available for this session');
      setBehavioralAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto mt-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link href="/interview/history" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← Back to History
            </Link>
            <h2 className="text-3xl font-bold text-gray-800">Interview Session Details</h2>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading session details...</span>
          </div>
        ) : !interviewSession ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Session not found</h3>
            <p className="text-gray-500">The interview session you're looking for doesn't exist.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Session Overview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Session Overview</h3>
                  <p className="text-gray-500 text-sm">
                    {new Date(interviewSession.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  interviewSession.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {interviewSession.status || 'Draft'}
                </span>
              </div>
              
              {interviewSession.jobDescription && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Job Description</h4>
                  <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                    {interviewSession.jobDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Behavioral Analysis Dashboard */}
            {behavioralAnalysis && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Behavioral Analysis</h3>
                <SentimentDashboard 
                  sentimentData={behavioralAnalysis}
                  videoMetrics={interviewSession.videoMetrics}
                />
              </div>
            )}

            {/* Loading Behavioral Analysis */}
            {loadingAnalysis && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Behavioral Analysis</h3>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading behavioral analysis...</span>
                </div>
              </div>
            )}

            {/* Questions and Responses */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Questions & Responses</h3>
              
              {interviewSession.questions && interviewSession.questions.length > 0 ? (
                <div className="space-y-6">
                  {interviewSession.questions.map((q, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-6">
                      <h4 className="font-semibold text-lg text-gray-800 mb-2">
                        Question {index + 1}
                      </h4>
                      <p className="text-gray-700 mb-4">{q.questionText}</p>
                      
                      {/* User Answer */}
                      <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <h5 className="font-semibold text-blue-800 mb-2">Your Answer</h5>
                        <p className="text-blue-700">
                          {q.userAnswer || 'No answer provided'}
                        </p>
                      </div>
                      
                      {/* AI Feedback */}
                      {q.aiFeedback && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-green-800 mb-2">AI Feedback</h5>
                          <p className="text-green-700">{q.aiFeedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No questions found for this session.</p>
                </div>
              )}
            </div>

            {/* Session Metrics (if available) */}
            {interviewSession.sessionMetrics && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Session Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {interviewSession.sessionMetrics.totalDuration && (
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800">Total Duration</h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(interviewSession.sessionMetrics.totalDuration / 60)}m
                      </p>
                    </div>
                  )}
                  {interviewSession.sessionMetrics.averageConfidence && (
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800">Avg Confidence</h4>
                      <p className="text-2xl font-bold text-green-600">
                        {interviewSession.sessionMetrics.averageConfidence}/10
                      </p>
                    </div>
                  )}
                  {interviewSession.sessionMetrics.completionRate && (
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-800">Completion</h4>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round(interviewSession.sessionMetrics.completionRate * 100)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
