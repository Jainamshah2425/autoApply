'use client';
import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TestOAuthPage() {
  const { data: session } = useSession();
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);

  const testBackendConnection = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/`);
      setTestResults(prev => ({
        ...prev,
        backendConnection: { success: true, data: response.data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        backendConnection: { success: false, error: error.message }
      }));
    }
    setLoading(false);
  };

  const testGmailStatus = async () => {
    if (!session?.user?.email) {
      alert('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      // First get user ID
      const userResponse = await axios.get(`${API_URL}/api/user/by-email/${session.user.email}`);
      const userId = userResponse.data._id;

      // Then check Gmail status
      const gmailResponse = await axios.get(`${API_URL}/api/email/gmail-status/${userId}`);
      setTestResults(prev => ({
        ...prev,
        gmailStatus: { success: true, data: gmailResponse.data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        gmailStatus: { success: false, error: error.response?.data || error.message }
      }));
    }
    setLoading(false);
  };

  const testEmailSend = async () => {
    if (!session?.user?.email) {
      alert('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const userResponse = await axios.get(`${API_URL}/api/user/by-email/${session.user.email}`);
      const userId = userResponse.data._id;

      const emailResponse = await axios.post(`${API_URL}/api/email/send`, {
        userId,
        to: session.user.email,
        subject: 'Test Email',
        message: 'This is a test email from your interview app.'
      });

      setTestResults(prev => ({
        ...prev,
        emailSend: { success: true, data: emailResponse.data }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        emailSend: { success: false, error: error.response?.data || error.message }
      }));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OAuth Debug Panel</h1>
        
        {/* Authentication Status */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          {session ? (
            <div>
              <p className="text-green-600">✅ Signed in as: {session.user.email}</p>
              <button
                onClick={() => signOut()}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600">❌ Not signed in</p>
              <button
                onClick={() => signIn('google')}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Sign In with Google
              </button>
            </div>
          )}
        </div>

        {/* Test Buttons */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Tests</h2>
          <div className="space-y-3">
            <button
              onClick={testBackendConnection}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Test Backend Connection
            </button>
            <button
              onClick={testGmailStatus}
              disabled={loading || !session}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Check Gmail Status
            </button>
            <button
              onClick={testEmailSend}
              disabled={loading || !session}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Test Email Send
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
