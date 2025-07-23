'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../../components/header';
import Link from 'next/link';

export default function InterviewHistoryPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (session?.user?.email) {
      axios
        .get(`http://localhost:5000/api/user/by-email/${session.user.email}`)
        .then((res) => setUserId(res.data.userId))
        .catch((err) => console.error('Failed to load user', err));
    }
  }, [session]);

  useEffect(() => {
    if (userId) {
      axios
        .get(`http://localhost:5000/api/interview/sessions/${userId}`)
        .then((res) => {
          setSessions(res.data.sessions);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load sessions', err);
          setLoading(false);
        });
    }
  }, [userId]);

  return (
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-4">Interview History</h2>
        {loading ? (
          <p>Loading...</p>
        ) : sessions.length === 0 ? (
          <p>No interview sessions found.</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session._id} className="p-4 border rounded-lg shadow bg-white">
                <h3 className="font-bold text-lg">Session from {new Date(session.createdAt).toLocaleString()}</h3>
                <p className="text-sm text-gray-500 truncate">{session.jobDescription}</p>
                <Link href={`/interview/history/${session._id}`} className="text-blue-600 underline hover:text-blue-800">
                  View Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
