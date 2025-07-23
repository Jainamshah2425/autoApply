'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../../../components/header';
import { useParams } from 'next/navigation';

export default function SessionDetailPage() {
  const { data: session } = useSession();
  const [interviewSession, setInterviewSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const { sessionId } = params;

  useEffect(() => {
    if (sessionId) {
      axios
        .get(`http://localhost:5000/api/interview/session/${sessionId}`)
        .then((res) => {
          setInterviewSession(res.data.session);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load session', err);
          setLoading(false);
        });
    }
  }, [sessionId]);

  return (
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-4">Interview Session Details</h2>
        {loading ? (
          <p>Loading...</p>
        ) : !interviewSession ? (
          <p>Session not found.</p>
        ) : (
          <div>
            <div className="p-4 bg-white rounded-lg shadow mb-6">
              <h3 className="font-bold text-lg">Job Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{interviewSession.jobDescription}</p>
            </div>
            <div className="space-y-4">
              {interviewSession.questions.map((q, index) => (
                <div key={index} className="p-4 border rounded-lg shadow bg-white">
                  <h4 className="font-semibold">Question {index + 1}</h4>
                  <p>{q.questionText}</p>
                  <div className="mt-4 p-2 bg-gray-100 rounded">
                    <h5 className="font-semibold">Your Answer</h5>
                    <p className="text-sm">{q.userAnswer || 'No answer provided'}</p>
                  </div>
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <h5 className="font-semibold text-green-800">AI Feedback</h5>
                    <p className="text-sm text-green-700">{q.aiFeedback || 'No feedback provided'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
