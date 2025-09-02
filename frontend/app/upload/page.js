'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Header from '../../components/header';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function UploadPage() {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState(null);
  const [skills, setSkills] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      setIsGmailConnected(true);
      setUploadStatus('✅ Gmail connected successfully!');
    } else if (gmailStatus === 'failed') {
      setUploadStatus('❌ Failed to connect Gmail. Please try again.');
    }
  }, [searchParams]);

  // Fetch user ID from backend based on session email
  useEffect(() => {
    if (session?.user?.email) {
      axios
        .get(`${API_URL}/api/user/by-email/${session.user.email}`)
        .then((res) => {
          setUserId(res.data._id);
          setIsGmailConnected(!!res.data.gmailTokens);
        })
        .catch((err) => console.error('Failed to load user ID', err));
    }
  }, [session]);

  // 📤 Upload resume to backend
  const uploadResume = async () => {
    if (!resumeFile || !userId) return;

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('userId', userId);

    try {
      setUploadStatus('Uploading...');
      await axios.post(`${API_URL}/api/user/upload-resume`, formData);
      setUploadStatus('✅ Resume uploaded successfully!');
    } catch (err) {
      console.error('Upload failed', err);
      setUploadStatus('❌ Failed to upload resume');
    }
  };

  // 🧠 Generate cover letter
  const generateCoverLetter = async () => {
    if (!userId) return;

    try {
      const res = await axios.post(`${API_URL}/api/llm/generate-cover-letter`, {
        userId,
        jobTitle,
        companyName: company,
        skills,
      });
      setCoverLetter(res.data.letter);
    } catch (err) {
      console.error('Failed to generate cover letter:', err);
      alert('❌ Cover letter generation failed.');
    }
  };

  // 📬 Send the letter to HR
  const sendEmail = async () => {
    if (!userId || !coverLetter || !recipientEmail) return;

    try {
      await axios.post(`${API_URL}/api/email/send`, {
        userId,
        to: recipientEmail,
        subject: `Application for ${jobTitle}`,
        message: coverLetter,
      });
      alert('✅ Email sent!');
    } catch (err) {
      console.error('Email failed:', err);
      if (err.response?.data?.needsAuth) {
        alert('❌ Gmail not connected. Please connect your Gmail account first.');
        setIsGmailConnected(false);
      } else {
        alert('❌ Failed to send email');
      }
    }
  };

  const connectGmail = () => {
    if (userId) {
      window.location.href = `${API_URL}/api/auth/google?userId=${userId}`;
    }
  };

  if (!mounted || status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Please log in with Google to use this feature.</p>
      </main>
    );
  }

  return (
    <>
    <Header />
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      
      <div className="max-w-2xl mx-auto mt-10">
        <h2 className="text-2xl font-semibold mb-4">Upload Resume & Generate Cover Letter</h2>

        {/* Resume upload */}
        <div className="mb-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setResumeFile(e.target.files[0])}
            className="mb-2"
          />
          <button
            onClick={uploadResume}
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            disabled={!resumeFile}
          >
            Upload Resume
          </button>
          {uploadStatus && <p className="text-sm mt-2">{uploadStatus}</p>}
        </div>

        {/* Cover letter form */}
        <input
          type="text"
          className="w-full border rounded p-2 mb-3"
          placeholder="Your Skills (comma-separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
        <input
          type="text"
          className="w-full border rounded p-2 mb-3"
          placeholder="Job Title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <input
          type="text"
          className="w-full border rounded p-2 mb-3"
          placeholder="Company Name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          type="email"
          className="w-full border rounded p-2 mb-3"
          placeholder="Recipient Email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />

        <div className="flex gap-4 mt-2">
          <button
            onClick={generateCoverLetter}
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={!userId}
          >
            Generate Letter
          </button>
          <button
            onClick={connectGmail}
            className={`${
              isGmailConnected ? 'bg-green-600' : 'bg-red-600'
            } text-white px-4 py-2 rounded`}
            disabled={!userId}
          >
            {isGmailConnected ? 'Gmail Connected' : 'Connect Gmail'}
          </button>
          <button
            onClick={sendEmail}
            className="bg-green-600 text-white px-4 py-2 rounded"
            disabled={!coverLetter || !userId || !isGmailConnected}
          >
            Send Email
          </button>
        </div>

        {/* Output */}
        {coverLetter && (
          <div className="mt-6 p-4 border rounded bg-white whitespace-pre-wrap shadow">
            <h3 className="font-bold mb-2">Generated Cover Letter:</h3>
            <p>{coverLetter}</p>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
