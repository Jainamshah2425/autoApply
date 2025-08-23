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
    <main className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Search Dashboard</h1>
          <p className="text-gray-600">Discover and apply to your next opportunity with AI-powered precision</p>
        </div>

        {/* Domain Selection Card */}
        <div className="mb-8 animate-slideInLeft">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">🎯</span>
              <h2 className="text-xl font-semibold text-gray-900">Target Your Search</h2>
            </div>
            <p className="text-gray-600 mb-4">Select your preferred domain to find relevant opportunities</p>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1">
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Industry Domain
                </label>
                <select
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  <option value="web-development">🌐 Web Development</option>
                  <option value="data-science">📊 Data Science</option>
                  <option value="machine-learning">🤖 Machine Learning</option>
                  <option value="marketing">📢 Marketing</option>
                  <option value="ui-ux">🎨 UI/UX Design</option>
                  <option value="graphic-design">🖼️ Graphic Design</option>
                  <option value="finance">💰 Finance</option>
                  <option value="full-stack">⚡ Full Stack Development</option>
                  <option value="frontend">🎯 Frontend Development</option>
                  <option value="backend">⚙️ Backend Development</option>
                </select>
              </div>
              <Button
                onClick={fetchJobs}
                disabled={scrapeLoading}
                className="enhanced-button"
                size="lg"
              >
                {scrapeLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔍</span>
                    Find Jobs
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 animate-slideInRight">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-red-500 text-xl mr-3">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-800">Search Error</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto Apply Section */}
        {/* <div className="mb-8 animate-slideInRight">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div className="mb-4 sm:mb-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Apply?</h3>
                <p className="text-gray-600">
                  {jobs.length > 0 
                    ? `Apply to all ${jobs.length} relevant positions with one click`
                    : 'Search for jobs first, then apply automatically'
                  }
                </p>
                {!userId && (
                  <p className="text-sm text-amber-600 mt-1">⏳ Loading user profile...</p>
                )}
              </div>
              <Button
                onClick={autoApply}
                disabled={!userId || loading || jobs.length === 0}
                size="lg"
                className="enhanced-button bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Applying...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🚀</span>
                    Auto-Apply ({jobs.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div> */}

        {/* Jobs List */}
        {scrapeLoading ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                <span className="text-lg text-gray-600">Discovering opportunities...</span>
              </div>
            </div>
            {/* Skeleton cards */}
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-shimmer bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-gray-900">
                Found {jobs.length} Opportunities
              </h3>
              <div className="text-sm text-gray-500">
                💡 Tip: Review each position before applying
              </div>
            </div>
            
            <div className="grid gap-6">
              {jobs.map((job, i) => (
                <div 
                  key={i} 
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-scaleIn"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h4>
                      <div className="flex items-center text-gray-600 mb-3 space-x-4">
                        <div className="flex items-center">
                          <span className="mr-1">🏢</span>
                          <span className="font-medium">{job.company}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-1">📍</span>
                          <span>{job.location}</span>
                        </div>
                      </div>
                      {job.description && (
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0 sm:ml-6">
                      <Button variant="outline" size="sm" className="enhanced-button">
                        <span className="mr-1">👁️</span>
                        Preview
                      </Button>
                      <Button 
                        asChild
                        size="sm"
                        className="enhanced-button"
                      >
                        <a 
                          href={job.url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          <span className="mr-1">🔗</span>
                          View Details
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 animate-fadeIn">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Jobs Found</h3>
            <p className="text-gray-600 mb-6">
              Try selecting a different domain or check back later for new opportunities.
            </p>
            <Button onClick={fetchJobs} variant="outline" className="enhanced-button">
              <span className="mr-2">🔄</span>
              Refresh Search
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}