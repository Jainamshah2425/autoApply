'use client';
import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../components/header';
import dynamic from 'next/dynamic';
import SessionInsights from '../../components/SessionInsights';
import QuestionAnalytics from '../../components/QuestionAnalytics';

// Use environment variable for API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const ReactMediaRecorder = dynamic(
  () => import('react-media-recorder').then((mod) => mod.ReactMediaRecorder),
  { ssr: false }
);

const VideoPreview = ({ stream }) => {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay muted playsInline />;
};

export default function InterviewPrepPage() {
  const { data: session, status } = useSession();
  const [jobDescription, setJobDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Enhanced state for session management
  const [sessionState, setSessionState] = useState({
    isActive: false,
    startTime: null,
    questionTimings: [],
    overallMetrics: {},
    sessionId: null
  });

  const [recordingState, setRecordingState] = useState({
    isRecording: false,
    recordingStartTime: null,
    audioBlob: null,
    transcript: ''
  });

  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionInsights, setSessionInsights] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [recordedVideoMetrics, setRecordedVideoMetrics] = useState(null); // New state for video metrics
  const [improvedAnswer, setImprovedAnswer] = useState('');
  const [isGeneratingImprovedAnswer, setIsGeneratingImprovedAnswer] = useState(false);
  
  // Camera permission state
  const [cameraPermission, setCameraPermission] = useState('unknown'); // 'granted', 'denied', 'prompt', 'unknown'
  const [permissionError, setPermissionError] = useState('');

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  

  // Load user ID when session is available
  useEffect(() => {
    if (session?.user?.email) {
      console.log('Fetching user ID for email:', session.user.email);
      axios.get(`${API_URL}/api/user/by-email/${session.user.email}`)
        .then(res => {
          console.log('API Response:', res.data);
          if (!res.data || !res.data._id) {
            throw new Error('No user ID in response');
          }
          setUserId(res.data._id);
          console.log('User ID set to:', res.data._id);
        })
        .catch(err => {
          console.error('Failed to load user ID:', err);
          setError('Failed to load user profile. Please try refreshing.');
        })
        .finally(() => {
          setIsLoadingUser(false);
        });
    } else {
      console.log('No session or email available');
      setIsLoadingUser(false); // Also set to false if no session/email
    }
  }, [session]);

  // Check camera and microphone permissions
  const checkMediaPermissions = useCallback(async () => {
    try {
      console.log('Checking media permissions...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError('Camera/microphone not supported in this browser');
        setCameraPermission('denied');
        return false;
      }

      // Try to get permission status if available
      if (navigator.permissions) {
        try {
          const cameraResult = await navigator.permissions.query({ name: 'camera' });
          const microphoneResult = await navigator.permissions.query({ name: 'microphone' });
          
          console.log('Permission status:', {
            camera: cameraResult.state,
            microphone: microphoneResult.state
          });
          
          if (cameraResult.state === 'denied' || microphoneResult.state === 'denied') {
            setCameraPermission('denied');
            setPermissionError('Camera or microphone access denied. Please enable in browser settings.');
            return false;
          } else if (cameraResult.state === 'granted' && microphoneResult.state === 'granted') {
            setCameraPermission('granted');
            setPermissionError('');
            return true;
          } else {
            setCameraPermission('prompt');
            return true; // Will prompt when recording starts
          }
        } catch (permError) {
          console.log('Permission API not fully supported, will prompt during recording');
          setCameraPermission('prompt');
          return true;
        }
      } else {
        console.log('Permissions API not supported, will prompt during recording');
        setCameraPermission('prompt');
        return true;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionError('Error checking camera permissions: ' + error.message);
      setCameraPermission('unknown');
      return false;
    }
  }, []);

  // Request media permissions explicitly
  const requestMediaPermissions = useCallback(async () => {
    try {
      console.log('Requesting media permissions...');
      setPermissionError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log('Media permissions granted');
      setCameraPermission('granted');
      setPermissionError('');
      
      // Stop the stream immediately since we only wanted to check permissions
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('Media permission denied:', error);
      setCameraPermission('denied');
      
      let errorMessage = 'Camera/microphone access denied. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please click "Allow" when prompted, or enable in browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is being used by another application.';
      } else {
        errorMessage += error.message;
      }
      
      setPermissionError(errorMessage);
      return false;
    }
  }, []);

  // Check permissions when component mounts
  useEffect(() => {
    checkMediaPermissions();
  }, [checkMediaPermissions]);

  // Add this enhanced debugging version to your page.js
// Replace the generateQuestions function with this version:

const generateQuestions = useCallback(async () => {
  console.log('=== GENERATE QUESTIONS STARTED ===');
  
  setError('');

  // Validation
  if (!jobDescription.trim() && !jobDescriptionFile) {
    setError('Please enter a job description or upload a PDF');
    return;
  }

  if (jobDescription.trim() && jobDescription.trim().length < 50 && !jobDescriptionFile) {
    setError('Job description must be at least 50 characters long');
    return;
  }

  if (!userId) {
    setError('User profile not loaded. Please wait or refresh the page.');
    return;
  }

  setLoading(true);
  
  try {
    const formData = new FormData();
    formData.append('userId', userId);

    if (jobDescriptionFile) {
      formData.append('jobDescriptionFile', jobDescriptionFile);
    } else {
      formData.append('jobDescription', jobDescription.trim());
    }

    const res = await axios.post(`${API_URL}/api/interview/generate-questions`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!res.data || !Array.isArray(res.data.questions)) {
      throw new Error('Invalid response from server');
    }
    
    setQuestions(res.data.questions);
    setCurrentQuestionIndex(0);
    setFeedback(null);
    setUserAnswer('');
    setSessionComplete(false);
    setSessionInsights(null);
    
    setSessionState({
      isActive: true,
      startTime: Date.now(),
      questionTimings: [],
      overallMetrics: {},
      sessionId: res.data.sessionId
    });
    
    setError('');
    
  } catch (err) {
    console.error('=== API ERROR ===');
    console.error('Error object:', err);
    const errorMessage = err.response?.data?.message || 
                        err.response?.data?.error || 
                        err.message ||
                        'An unexpected error occurred. Please try again.';
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
}, [jobDescription, userId, jobDescriptionFile]);

// Also add this enhanced debug component to see the current state:
const DebugInfo = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6 text-sm">
      <p><strong>Frontend Debug Info:</strong></p>
      <p>Session Status: {status}</p>
      <p>User Email: {session?.user?.email || 'Not loaded'}</p>
      <p>User ID: {userId || 'Not loaded'}</p>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
      <p>Questions Length: {questions.length}</p>
      <p>Questions Array: {JSON.stringify(questions.slice(0, 2))}...</p>
      <p>Current Question Index: {currentQuestionIndex}</p>
      <p>Session Active: {sessionState.isActive ? 'Yes' : 'No'}</p>
      <p>Session ID: {sessionState.sessionId || 'None'}</p>
      <p>Error: {error || 'None'}</p>
    </div>
  );
};

// Add this component right after your existing debug info in the render:
// <DebugInfo />
  const analyzeAnswer = useCallback(async (answerToAnalyze) => {
    if (!answerToAnalyze.trim()) {
      setError('Please provide an answer');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const audioMetrics = recordingState.recordingStartTime ? {
        duration: (Date.now() - recordingState.recordingStartTime) / 1000,
        wordsPerMinute: Math.round((answerToAnalyze.split(' ').length / ((Date.now() - recordingState.recordingStartTime) / 1000)) * 60),
        wordCount: answerToAnalyze.split(' ').length
      } : null;

      const res = await axios.post(`${API_URL}/api/interview/analyze-answer`, {
        question: questions[currentQuestionIndex],
        answer: answerToAnalyze,
        audioMetrics,
        sessionId: sessionState.sessionId,
        questionIndex: currentQuestionIndex
      });
      
      setFeedback(res.data);
      
      // Update question timing
      const newTiming = {
        questionIndex: currentQuestionIndex,
        question: questions[currentQuestionIndex],
        answer: answerToAnalyze,
        metrics: audioMetrics,
        analysis: res.data,
        timestamp: Date.now()
      };
      
      setSessionState(prev => ({
        ...prev,
        questionTimings: [...prev.questionTimings, newTiming]
      }));
      
    } catch (err) {
      console.error('Failed to analyze answer:', err);
      setError('Failed to analyze answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [questions, currentQuestionIndex, recordingState.recordingStartTime, sessionState.sessionId]);

  const processRecording = async (blobUrl, blob) => {
    console.log('processRecording called with:', { blobUrl, blobSize: blob?.size });
    
    if (!blob || blob.size === 0) {
      setError('Recording failed - no video data captured. Please try again.');
      return;
    }
    
    setIsTranscribing(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('video', blob, 'recording.webm');
      formData.append('userId', userId);
      formData.append('sessionId', sessionState.sessionId);
      formData.append('questionIndex', currentQuestionIndex);
      formData.append('questionText', questions[currentQuestionIndex]);

      console.log('Sending video to backend:', {
        blobSize: blob.size,
        userId,
        sessionId: sessionState.sessionId,
        questionIndex: currentQuestionIndex
      });

      // Use the Express backend endpoint for video transcription
      const res = await axios.post(`${API_URL}/api/interview/analyze-video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000, // 3 minutes for video processing
      });
      
      console.log('Backend response:', res.data);
      
      if (res.data.success && res.data.transcription) {
        setTranscription(res.data.transcription);
        setUserAnswer(res.data.transcription);
        setRecordedVideoMetrics(res.data.video_metrics);
        setError('');
        console.log('Video processed successfully:', {
          transcriptionLength: res.data.transcription.length,
          videoMetrics: res.data.video_metrics
        });
      } else {
        throw new Error('No transcription received from server');
      }
      
    } catch (error) {
      console.error('Error in processRecording:', error);
      
      let errorMessage = 'Failed to process your recording. ';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage += 'The analysis took too long. Please try with a shorter recording.';
      } else if (error.response?.status === 422) {
        errorMessage += 'Invalid video format. Please try recording again.';
      } else if (error.response?.status === 400) {
        errorMessage += error.response.data?.error || 'Bad request. Please check your recording.';
      } else if (error.response?.status === 500) {
        errorMessage += 'Server error. Please try again later.';
      } else if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += 'Please check your connection and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  };

  const analyzeRecordedAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      setError('No recorded answer to analyze. Please record first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/api/interview/analyze-answer`, {
        question: questions[currentQuestionIndex],
        answer: userAnswer,
        audioMetrics: recordedVideoMetrics, // Use recorded video metrics as audioMetrics
        sessionId: sessionState.sessionId,
        questionIndex: currentQuestionIndex
      });

      setFeedback(res.data);

      // Update question timing
      const newTiming = {
        questionIndex: currentQuestionIndex,
        question: questions[currentQuestionIndex],
        answer: userAnswer,
        metrics: recordedVideoMetrics, // Use video analysis as metrics
        analysis: res.data,
        timestamp: Date.now()
      };
      
      setSessionState(prev => ({
        ...prev,
        questionTimings: [...prev.questionTimings, newTiming]
      }));

    } catch (err) {
      console.error('Failed to analyze recorded answer:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      
      let errorMessage = 'Failed to analyze recorded answer. ';
      if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.response?.data?.details) {
        errorMessage += err.response.data.details;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userAnswer, recordedVideoMetrics, questions, currentQuestionIndex, sessionState.sessionId]);

  const handleStartRecording = useCallback(async () => {
    console.log('handleStartRecording called, current permission:', cameraPermission);
    
    // Check permissions before starting recording
    if (cameraPermission === 'denied') {
      setError('Camera access denied. Please enable camera access in your browser settings and refresh the page.');
      return;
    }
    
    // If permission is unknown or prompt, try to request it
    if (cameraPermission !== 'granted') {
      console.log('Requesting media permissions...');
      const granted = await requestMediaPermissions();
      if (!granted) {
        setError('Camera access is required for video recording. Please allow access and try again.');
        return;
      }
    }
    
    // Clear any previous errors
    setPermissionError('');
    setError('');
    
    setRecordingState(prev => ({
      ...prev,
      isRecording: true,
      recordingStartTime: Date.now()
    }));
    setTranscription(''); // Clear transcription on new recording start
    setUserAnswer(''); // Clear user answer on new recording start
    setFeedback(null); // Clear feedback on new recording start
  }, [cameraPermission, requestMediaPermissions]);

  const completeSession = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_URL}/api/interview/complete-session`, {
        sessionId: sessionState.sessionId,
        userId,
        questionTimings: sessionState.questionTimings
      });
      
      setSessionInsights(res.data.insights);
      setSessionComplete(true);
      setSessionState(prev => ({ ...prev, isActive: false }));
      
      // Handle heatmap update response
      if (res.data.heatmapUpdate?.success) {
        console.log('✅ Heatmap updated successfully:', res.data.heatmapUpdate);
        
        // Optional: Show success message about activity tracking
        if (res.data.heatmapUpdate.contributionAdded) {
          console.log('🔥 New activity added to your heatmap!');
        }
        
        // Optional: Trigger real-time refresh if user is on profile page
        // This would require implementing a WebSocket or polling mechanism
        // For now, we'll use localStorage to signal profile page to refresh
        try {
          const heatmapUpdateEvent = {
            timestamp: Date.now(),
            type: 'interview_completed',
            date: res.data.heatmapUpdate.date || new Date().toISOString().split('T')[0],
            userId: userId
          };
          localStorage.setItem('heatmapUpdate', JSON.stringify(heatmapUpdateEvent));
          
          // Dispatch custom event for real-time updates
          window.dispatchEvent(new CustomEvent('heatmapUpdated', { 
            detail: heatmapUpdateEvent 
          }));
        } catch (storageError) {
          console.warn('Failed to store heatmap update event:', storageError);
        }
      } else {
        console.warn('⚠️ Heatmap update failed:', res.data.heatmapUpdate);
      }
      
    } catch (err) {
      console.error('Failed to complete session:', err);
      setError('Failed to complete session. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [sessionState.sessionId, sessionState.questionTimings, userId]);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setFeedback(null);
      setRecordingState({
        isRecording: false,
        recordingStartTime: null,
        audioBlob: null,
        transcript: ''
      });
    } else {
      // Complete session
      completeSession();
    }
  }, [currentQuestionIndex, questions.length, completeSession]);

  const resetSession = useCallback(() => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setFeedback(null);
    setSessionComplete(false);
    setSessionInsights(null);
    setError('');
    setSessionState({
      isActive: false,
      startTime: null,
      questionTimings: [],
      overallMetrics: {},
      sessionId: null
    });
    setRecordingState({
      isRecording: false,
      recordingStartTime: null,
      audioBlob: null,
      transcript: ''
    });
    setImprovedAnswer('');
  }, []);

  const generateImprovedAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      setError('Please provide an answer to improve');
      return;
    }

    setIsGeneratingImprovedAnswer(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/api/llm/generate-improved-answer`, {
        question: questions[currentQuestionIndex],
        userAnswer: userAnswer,
        jobDescription: jobDescription,
        userId: userId
      });

      setImprovedAnswer(res.data.improvedAnswer);
    } catch (err) {
      console.error('Failed to generate improved answer:', err);
      setError('Failed to generate improved answer. Please try again.');
    } finally {
      setIsGeneratingImprovedAnswer(false);
    }
  }, [userAnswer, questions, currentQuestionIndex, jobDescription, userId]);

  const uploadResume = async () => {
    if (!resumeFile || !userId) {
      setUploadStatus('Please select a file and ensure you are logged in');
      return;
    }

    if (resumeFile.type !== 'application/pdf') {
      setUploadStatus('Please upload a PDF file only');
      return;
    }

    if (resumeFile.size > 5 * 1024 * 1024) {
      setUploadStatus('File size must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('userId', userId);

    try {
      setIsUploading(true);
      setUploadStatus('Uploading...');
      
      const res = await axios.post(`${API_URL}/api/user/upload-resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });
      
      setUploadStatus('Resume uploaded successfully!');
      setResumeFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
    } catch (err) {
      if (err.response) {
        setUploadStatus(`Upload failed: ${err.response.data.error || 'Server error'}`);
      } else if (err.request) {
        setUploadStatus('Upload failed: No response from server');
      } else {
        setUploadStatus('Upload failed: Network error');
      }
    } finally {
      setIsUploading(false);
    }
  };
  

  // Loading state for authentication
  if (status === 'loading' || isLoadingUser) {
    return (
      <main className="min-h-screen px-4 py-8 bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto mt-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading user profile...</p>
          </div>
        </div>
      </main>
    );
  }

  // Not authenticated
  if (status === 'unauthenticated') {
    return (
      <main className="min-h-screen px-4 py-8 bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto mt-8">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please sign in to access the interview prep tool.</p>
          </div>
        </div>
      </main>
    );
  }

  // Session complete view
  if (sessionComplete && sessionInsights) {
    return (
      <main className="min-h-screen px-4 py-8 bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto mt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Interview Session Complete</h2>
            <button
              onClick={resetSession}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Start New Session
            </button>
          </div>
          <SessionInsights sessionData={sessionInsights} />
        </div>
      </main>
    );
  }

  return (
    <>
     <Header />
    <main className="min-h-screen px-4 py-8 bg-gray-50">
     
      <div className="max-w-4xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-4">AI Interview Prep</h2>
        
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">⚠️</div>
              <div className="text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6 text-sm">
            <p><strong>Debug Info:</strong></p>
            <p>Session Status: {status}</p>
            <p>User Email: {session?.user?.email || 'Not loaded'}</p>
            <p>User ID: {userId || 'Not loaded'}</p>
            <p>Loading: {loading ? 'Yes' : 'No'}</p>
          </div>
        )}

        {/* Resume Upload */}
        <div className="p-4 bg-white rounded-lg shadow mb-6">
          <label htmlFor="resume-upload" className="block mb-2 text-sm font-medium text-gray-700">
            Upload Your Resume (PDF only)
          </label>
          <input
            id="resume-upload"
            type="file"
            accept="application/pdf"
            onChange={(e) => setResumeFile(e.target.files[0])}
            className="w-full border rounded p-2"
          />
          <button
            onClick={uploadResume}
            disabled={isUploading || !resumeFile}
            className="bg-indigo-600 text-white px-4 py-2 rounded mt-2 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload Resume'}
          </button>
          {uploadStatus && <p className="text-sm mt-2">{uploadStatus}</p>}
        </div>
        
        {/* Job Description Input */}
        <div className="p-4 bg-white rounded-lg shadow mb-6">
          <label htmlFor="job-desc-file" className="block mb-2 text-sm font-medium text-gray-700">
            Upload Job Description (PDF)
          </label>
          <input
            id="job-desc-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setJobDescriptionFile(e.target.files[0])}
            className="w-full border rounded p-2"
          />
          <div className="my-4 text-center text-gray-500">OR</div>
          <label htmlFor="job-desc" className="block mb-2 text-sm font-medium text-gray-700">
            Paste Job Description Here
          </label>
          <textarea
            id="job-desc"
            rows="6"
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Enter the job description to generate tailored interview questions..."
            disabled={loading || !!jobDescriptionFile}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">
              {jobDescription.length} characters (minimum 50 required)
            </span>
            <button
              onClick={generateQuestions}
              disabled={loading || (!jobDescription.trim() && !jobDescriptionFile) || (jobDescription.trim() && jobDescription.length < 50 && !jobDescriptionFile) || !userId}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Questions'}
            </button>
          </div>
        </div>

        {/* Session Progress */}
        {sessionState.isActive && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-blue-800">Interview Session Active</h3>
                <p className="text-sm text-blue-600">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">
                  Session Duration: {Math.floor((Date.now() - sessionState.startTime) / 60000)}m {Math.floor(((Date.now() - sessionState.startTime) % 60000) / 1000)}s
                </p>
              </div>
            </div>
            <div className="mt-2 bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Questions Section */}
        {questions.length > 0 && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-2">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h3>
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-gray-800">{questions[currentQuestionIndex]}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Text Answer Option */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Option 1: Type Your Answer</h4>
                <textarea
                  rows="6"
                  className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Type your answer here..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={loading}
                />
                <button
                  onClick={() => analyzeAnswer(userAnswer)}
                  disabled={loading || !userAnswer.trim()}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-green-700 transition-colors"
                >
                  {loading ? 'Analyzing...' : 'Analyze My Answer'}
                </button>
              </div>

              {/* Audio Recording Option */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Option 2: Record Your Answer</h4>
                
                {/* Permission Status Display */}
                {cameraPermission !== 'granted' && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-yellow-800">Camera & Microphone Access Required</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          {cameraPermission === 'denied' 
                            ? 'Camera access was denied. Please enable it in your browser settings and refresh the page.'
                            : 'Please allow camera and microphone access to record your answer.'
                          }
                        </p>
                        {permissionError && (
                          <p className="text-sm text-red-600 mt-2">{permissionError}</p>
                        )}
                        {cameraPermission !== 'denied' && (
                          <button
                            onClick={requestMediaPermissions}
                            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
                          >
                            Enable Camera Access
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-6 bg-gray-50 rounded-xl shadow-inner border border-gray-200">
                  {isTranscribing ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Processing your recording...</p>
                        <p className="text-sm text-gray-500 mt-2">This may take up to 3 minutes</p>
                      </div>
                    </div>
                  ) : (
                    <ReactMediaRecorder
                      video
                      audio
                      onStop={processRecording}
                      mediaRecorderOptions={{
                        mimeType: 'video/webm;codecs=vp9,opus'
                      }}
                      render={({ status, startRecording, stopRecording, previewStream, error }) => (
                        <div className="space-y-5">
                          {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                              <strong>Recording error:</strong> {error}
                              <br />
                              <span className="text-xs">This usually means camera/microphone access was denied. Please refresh and allow access.</span>
                            </div>
                          )}
                          <div className="relative w-full aspect-video bg-gray-200 rounded-lg overflow-hidden shadow-md">
                            <VideoPreview stream={previewStream} />
                            {status === 'recording' && (
                              <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center">
                                <span className="w-2 h-2 bg-white rounded-full mr-2"></span> Recording
                              </div>
                            )}
                            {status === 'idle' && !previewStream && (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                                {cameraPermission === 'granted' ? 'Camera Preview' : 'Camera access needed'}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Status: 
                              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-semibold ${
                                status === 'recording' ? 'bg-red-100 text-red-800' :
                                status === 'stopped' ? 'bg-green-100 text-green-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            </span>
                            {recordingState.isRecording && (
                              <span className="text-sm text-gray-600">
                                Duration: {Math.floor((Date.now() - recordingState.recordingStartTime) / 1000)}s
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={async () => {
                                console.log('Starting recording...');
                                await handleStartRecording();
                                if (cameraPermission === 'granted') {
                                  startRecording();
                                }
                              }}
                              disabled={status === 'recording' || loading || isTranscribing || cameraPermission === 'denied'}
                              className="flex-1 bg-red-600 text-white px-5 py-3 rounded-lg shadow-md hover:bg-red-700 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v.75H15a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H9.75A2.25 2.25 0 0 1 7.5 18.75V7.5H6.75A2.25 2.25 0 0 1 4.5 5.25v-.75ZM6 7.5v10.5c0 .414.336.75.75.75h.75V7.5H6Zm10.5 0v10.5c0 .414-.336.75-.75.75h-.75V7.5h.75Z" />
                              </svg>
                              <span>
                                {cameraPermission === 'denied' ? 'Camera Denied' : 'Start Recording'}
                              </span>
                            </button>
                            <button 
                              onClick={() => {
                                console.log('Stopping recording...');
                                stopRecording();
                                setRecordingState(prev => ({ ...prev, isRecording: false }));
                              }}
                              disabled={status !== 'recording' || loading || isTranscribing}
                              className="flex-1 bg-gray-600 text-white px-5 py-3 rounded-lg shadow-md hover:bg-gray-700 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                              </svg>
                              <span>Stop Recording</span>
                            </button>
                          </div>
                          {transcription && (
                            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <h3 className="font-bold text-gray-800 mb-2">Transcription:</h3>
                              <p className="text-gray-700 text-sm leading-relaxed">{transcription}</p>
                              <button
                                onClick={analyzeRecordedAnswer}
                                disabled={loading || !transcription.trim()}
                                className="w-full bg-purple-600 text-white px-4 py-2 rounded mt-4 disabled:opacity-50 hover:bg-purple-700 transition-colors"
                              >
                                {loading ? 'Analyzing...' : 'Analyze Recorded Answer'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                {feedback ? '✓ Answer analyzed' : 'Provide an answer to continue'}
              </div>
              <button
                onClick={nextQuestion}
                disabled={!feedback || loading}
                className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {currentQuestionIndex === questions.length - 1 ? 'Complete Session' : 'Next Question →'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback Section */}
        {feedback && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-6">
            <h3 className="font-semibold text-green-800 mb-3">AI Feedback</h3>
            <QuestionAnalytics data={feedback} />
            
            {/* AI-Enhanced Answer Generator */}
            <div className="mt-6 pt-4 border-t border-green-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-green-800">AI-Enhanced Answer Generator</h3>
                <button
                  onClick={generateImprovedAnswer}
                  disabled={isGeneratingImprovedAnswer || !userAnswer.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isGeneratingImprovedAnswer ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "Generate Improved Answer"
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Get an AI-enhanced version of  answer 
              </p>
              
              {improvedAnswer && (
                <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-800">Enhanced Answer</h4>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(improvedAnswer);
                        setError('Enhanced answer copied to clipboard!');
                        setTimeout(() => setError(''), 3000);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {improvedAnswer}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session completed */}

        {/* Transcribing Indicator */}
        {isTranscribing && <p className="text-sm text-gray-500 mt-4">Transcribing your answer...</p>}
      </div>
    </main>
    </>
  );
}