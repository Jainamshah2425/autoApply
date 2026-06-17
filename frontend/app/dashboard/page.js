'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUserId } from '@/hooks/useUserId';
import { api, getErrorMessage } from '@/lib/api';
import { Search, Building2, MapPin, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { userId, loading: userLoading, session } = useUserId();
  const [jobs, setJobs] = useState([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [domain, setDomain] = useState('web-development');
  const [error, setError] = useState(null);
  const [previewJob, setPreviewJob] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      setScrapeLoading(true);
      setError(null);
      const res = await api.get(`/api/jobs/scrape?domain=${domain}`);
      if (res.data.success) {
        setJobs(res.data.jobs || []);
      } else {
        setError(res.data.message || 'Failed to fetch jobs');
        setJobs([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch jobs'));
      setJobs([]);
    } finally {
      setScrapeLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (session) fetchJobs();
  }, [session, fetchJobs]);

  if (userLoading) {
    return (
      <PageLayout title="Job Search">
        <PageSkeleton />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Job Search"
      description="Discover internships and prepare your application materials."
      actions={
        <Button variant="outline" asChild>
          <Link href="/upload">Upload resume</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <label htmlFor="domain" className="block text-sm font-medium text-foreground mb-2">
              Industry domain
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="web-development">Web Development</option>
                <option value="data-science">Data Science</option>
                <option value="machine-learning">Machine Learning</option>
                <option value="marketing">Marketing</option>
                <option value="ui-ux">UI/UX Design</option>
                <option value="full-stack">Full Stack Development</option>
              </select>
              <Button onClick={fetchJobs} disabled={scrapeLoading}>
                {scrapeLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : <><Search className="w-4 h-4" /> Find jobs</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && <ErrorMessage title="Search error" message={error} />}

        {scrapeLoading ? (
          <PageSkeleton />
        ) : jobs.length > 0 ? (
          <div className="space-y-3">
            {jobs.map((job, i) => (
              <Card key={i}>
                <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-foreground">{job.title}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{job.company}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                    </div>
                    {job.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setPreviewJob(job)}>Preview</Button>
                    <Button size="sm" asChild>
                      <a href={job.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" /> Apply
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No jobs found"
            description="Try a different domain or refresh the search."
            action={
              <Button variant="outline" onClick={fetchJobs}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            }
          />
        )}
      </div>

      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setPreviewJob(null)}>
          <Card className="max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-medium">{previewJob.title}</h3>
              <p className="text-sm text-muted-foreground">{previewJob.company} · {previewJob.location}</p>
              <p className="text-sm whitespace-pre-wrap">{previewJob.description || 'No description available.'}</p>
              <div className="flex gap-2">
                <Button asChild><a href={previewJob.url} target="_blank" rel="noreferrer">Open listing</a></Button>
                <Button variant="outline" onClick={() => setPreviewJob(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
