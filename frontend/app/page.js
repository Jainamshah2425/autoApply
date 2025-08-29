'use client';
import Link from 'next/link';
import Header from '../components/header';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-100 to-white">
      <Header />
      <section className="text-center py-20 px-4">
        <h1 className="text-5xl font-extrabold text-gray-800 mb-6">🚀 AutoApplyAI</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
          Automatically apply to jobs using your resume, AI cover letters, and Gmail.Prepare for interviews with AI-generated questions and feedback.
        </p>
        <div className="space-x-4">
          <Link href="/upload">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition">Upload</button>
          </Link>
          <Link href="/dashboard">
            <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl transition">Dashboard</button>
          </Link>
          <Link href="/interview">
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl transition">Interview</button>
          </Link>
        </div>
      </section>
    </main>
  );
}
