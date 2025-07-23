"use client";
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Header from '../../components/header';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [domain, setDomain] = useState('web-development');
  const [error, setError] = useState(null);
  const [scrapeInfo, setScrapeInfo] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 🧠 Fetch userId based on session email
  useEffect(() => {
    if (session?.user?.email) {
      axios
        .get(`http://localhost:5000/api/user/by-email/${session.user.email}`)
        .then((res) => setUserId(res.data.userId))
        .catch((err) => console.error('Failed to load user', err));
    }
  }, [session]);

  // 🌐 Fetch jobs when domain changes
  useEffect(() => {
    if (domain) {
      fetchJobs();
    }
  }, [domain]);

  const fetchJobs = async () => {
    try {
      setScrapeLoading(true);
      setError(null);
      setScrapeInfo(null);
      
      console.log(`Fetching jobs for domain: ${domain}`);
      const res = await axios.get(`http://localhost:5000/api/jobs/scrape?domain=${domain}`);
      
      if (res.data.success) {
        setJobs(res.data.jobs);
        setScrapeInfo({
          count: res.data.count,
          domain: res.data.domain,
          url: res.data.url
        });
      } else {
        setError(res.data.message || 'Failed to fetch jobs');
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err);
      setError(err.response?.data?.message || 'Failed to fetch jobs');
    } finally {
      setScrapeLoading(false);
    }
  };

  const autoApply = async () => {
    if (!userId) return alert('User not loaded yet');

    try {
      setLoading(true);
      const response = await axios.post('http://localhost:5000/api/jobs/auto-apply', { userId });
      
      if (response.data.success) {
        alert(`✅ Auto-apply complete! Applied to ${response.data.appliedCount} jobs.`);
      } else {
        alert('❌ Failed to apply: ' + response.data.message);
      }
    } catch (err) {
      console.error('Auto-apply failed', err);
      alert('❌ Failed to apply: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/jobs/test');
      console.log('Test response:', response.data);
      alert('✅ Backend connection successful!');
    } catch (err) {
      console.error('Test failed:', err);
      alert('❌ Backend connection failed: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  if (!session || !mounted || status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Job Scraper Dashboard</h2>
          {/* <button
            onClick={testConnection}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm"
          >
            Test Backend
          </button> */}
        </div>

        {/* 🔽 Domain selector */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <label htmlFor="domain" className="block mb-2 text-sm font-medium text-gray-700">
            Select domain to scrape:
          </label>
          <div className="flex gap-4 items-center">
            <select
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="border rounded p-2 flex-1"
            >
              <option value="web-development">Web Development</option>
              <option value="data-science">Data Science</option>
              <option value="machine-learning">Machine Learning</option>
              <option value="marketing">Marketing</option>
              <option value="ui-ux">UI/UX Design</option>
              <option value="graphic-design">Graphic Design</option>
              <option value="finance">Finance</option>
              <option value="full-stack">Full Stack Development</option>
              <option value="frontend">Frontend Development</option>
              <option value="backend">Backend Development</option>
            </select>
            <Button
              onClick={fetchJobs}
              disabled={scrapeLoading}
            >
              {scrapeLoading ? 'Scraping...' : 'Scrape Jobs'}
            </Button>
          </div>
        </div>

        {/* 📊 Scrape Information
        {scrapeInfo && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Scrape Results</h3>
            <p className="text-sm text-green-700">
              Found <strong>{scrapeInfo.count}</strong> jobs for <strong>{scrapeInfo.domain}</strong>
            </p>
            <p className="text-xs text-green-600 mt-1">
              URL: {scrapeInfo.url}
            </p>
          </div>
        )} */}

        {/* ❌ Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 🛠️ Auto Apply Button */}
        <div className="mb-6">
          <Button
            onClick={autoApply}
            disabled={!userId || loading || jobs.length === 0}
          >
            {loading ? 'Applying...' : `Auto-Apply to ${jobs.length} Jobs`}
          </Button>
          {!userId && (
            <p className="text-sm text-gray-500 mt-2">
              Waiting for user data to load...
            </p>
          )}
        </div>

        {/* 📋 Jobs List */}
        {scrapeLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Scraping jobs...</p>
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Found {jobs.length} Jobs</h3>
            {jobs.map((job, i) => (
              <div key={i} className="p-4 border rounded-lg shadow bg-white">
                <h4 className="font-bold text-lg">{job.title}</h4>
                <p className="text-gray-700">{job.company}</p>
                <p className="text-sm text-gray-500">{job.location}</p>
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  View Details →
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No jobs found. Try selecting a different domain or check for errors above.
          </div>
        )}
      </div>
    </main>
  );
}