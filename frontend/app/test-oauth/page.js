'use client';
import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import PageLayout from '@/components/layout/page-layout';
import { api } from '@/lib/api';

export default function TestOAuthPage() {
  const { data: session } = useSession();
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-background">
        <PageLayout title="Not Found" description="This page is only available in development." />
      </div>
    );
  }

  const testBackendConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/');
      setTestResults(prev => ({
        ...prev,
        backendConnection: { success: true, data: response.data }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        backendConnection: { success: false, error: err.message }
      }));
    }
    setLoading(false);
  };

  const testGmailStatus = async () => {
    if (!session?.user?.email) {
      setError('Please sign in first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userResponse = await api.get(`/api/user/by-email/${session.user.email}`);
      const userId = userResponse.data._id;
      const gmailResponse = await api.get(`/api/email/gmail-status/${userId}`);
      setTestResults(prev => ({
        ...prev,
        gmailStatus: { success: true, data: gmailResponse.data }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        gmailStatus: { success: false, error: err.response?.data || err.message }
      }));
    }
    setLoading(false);
  };

  const testEmailSend = async () => {
    if (!session?.user?.email) {
      setError('Please sign in first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userResponse = await api.get(`/api/user/by-email/${session.user.email}`);
      const userId = userResponse.data._id;
      const emailResponse = await api.post('/api/email/send', {
        userId,
        to: session.user.email,
        subject: 'Test Email',
        message: 'This is a test email from your interview app.'
      });
      setTestResults(prev => ({
        ...prev,
        emailSend: { success: true, data: emailResponse.data }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        emailSend: { success: false, error: err.response?.data || err.message }
      }));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageLayout title="OAuth Debug Panel" description="Development-only diagnostics for auth and email.">
        {error && <div className="mb-6"><ErrorMessage title="Error" message={error} /></div>}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent>
            {session ? (
              <div>
                <p className="text-green-600 dark:text-green-400">Signed in as: {session.user.email}</p>
                <Button variant="destructive" onClick={() => signOut()} className="mt-2">
                  Sign Out
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-destructive">Not signed in</p>
                <Button variant="default" onClick={() => signIn('google')} className="mt-2">
                  Sign In with Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="default" onClick={testBackendConnection} disabled={loading} className="w-full">
              Test Backend Connection
            </Button>
            <Button variant="secondary" onClick={testGmailStatus} disabled={loading || !session} className="w-full">
              Check Gmail Status
            </Button>
            <Button variant="outline" onClick={testEmailSend} disabled={loading || !session} className="w-full">
              Test Email Send
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </PageLayout>
    </div>
  );
}
