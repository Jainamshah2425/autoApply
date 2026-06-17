'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import PageLayout from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ErrorMessage } from '@/components/ui/error-message';
import { SuccessMessage } from '@/components/ui/success-message';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUserId } from '@/hooks/useUserId';
import { api, API_URL, getErrorMessage } from '@/lib/api';
import { Upload, FileText, Send, Mail } from 'lucide-react';

function UploadPageContent() {
  const { userId, loading, session } = useUserId();
  const searchParams = useSearchParams();
  const [skills, setSkills] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      setStatus('Gmail connected successfully.');
      setIsGmailConnected(true);
    } else if (gmailStatus === 'failed') {
      setError('Failed to connect Gmail. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session?.user?.email) return;
    api.get(`/api/user/by-email/${session.user.email}`)
      .then((res) => setIsGmailConnected(!!res.data.gmailTokens))
      .catch(() => {});
  }, [session]);

  async function uploadResume() {
    if (!resumeFile || !userId) return;
    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('userId', userId);
    try {
      setError(null);
      await api.post('/api/user/upload-resume', formData);
      setStatus('Resume uploaded successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload resume'));
    }
  }

  async function generateCoverLetter() {
    if (!userId) return;
    try {
      setError(null);
      const res = await api.post('/api/llm/generate-cover-letter', {
        userId,
        jobTitle,
        companyName: company,
        skills,
      });
      setCoverLetter(res.data.letter);
      setStatus('Cover letter generated.');
    } catch (err) {
      setError(getErrorMessage(err, 'Cover letter generation failed'));
    }
  }

  async function sendEmail() {
    if (!userId || !coverLetter || !recipientEmail) return;
    try {
      setError(null);
      await api.post('/api/email/send', {
        userId,
        to: recipientEmail,
        subject: `Application for ${jobTitle}`,
        message: coverLetter,
      });
      setStatus('Email sent successfully.');
    } catch (err) {
      if (err.response?.data?.needsAuth) {
        setIsGmailConnected(false);
        setError('Gmail not connected. Connect Gmail first.');
      } else {
        setError(getErrorMessage(err, 'Failed to send email'));
      }
    }
  }

  function connectGmail() {
    if (userId && typeof window !== 'undefined') {
      window.location.href = `${API_URL}/api/auth/google?userId=${userId}`;
    }
  }

  if (loading) {
    return <PageLayout title="Upload & Apply"><PageSkeleton /></PageLayout>;
  }

  if (!session) {
    return (
      <PageLayout title="Upload & Apply">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Sign in to upload your resume and send applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn('google')}>Sign in with Google</Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Upload & Apply" description="Upload your resume, generate a cover letter, and send via Gmail.">
      <div className="space-y-6 max-w-2xl">
        {error && <ErrorMessage title="Error" message={error} />}
        {status && <SuccessMessage title="Done" message={status} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4" /> Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 bg-background">
              <FileText className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{resumeFile ? resumeFile.name : 'Select PDF resume'}</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
            </label>
            <Button onClick={uploadResume} disabled={!resumeFile} className="w-full">Upload resume</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Cover letter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Skills (comma-separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
            <Input placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <Input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input type="email" placeholder="Recipient email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={generateCoverLetter} disabled={!userId} className="flex-1">Generate letter</Button>
              <Button variant="secondary" onClick={connectGmail} disabled={!userId} className="flex-1">
                <Mail className="w-4 h-4" /> {isGmailConnected ? 'Gmail connected' : 'Connect Gmail'}
              </Button>
              <Button onClick={sendEmail} disabled={!coverLetter || !isGmailConnected} className="flex-1">
                <Send className="w-4 h-4" /> Send email
              </Button>
            </div>
          </CardContent>
        </Card>

        {coverLetter && (
          <Card>
            <CardHeader><CardTitle>Generated cover letter</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={coverLetter} readOnly rows={12} className="text-sm" />
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<PageLayout title="Upload & Apply"><PageSkeleton /></PageLayout>}>
      <UploadPageContent />
    </Suspense>
  );
}
