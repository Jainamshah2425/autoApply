'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/page-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorMessage } from '@/components/ui/error-message';
import { useUserId } from '@/hooks/useUserId';
import { api, getErrorMessage } from '@/lib/api';

export default function AptitudeHistoryPage() {
  const { userId, loading } = useUserId();
  const [attempts, setAttempts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setFetching(true);
    api.get(`/api/aptitude/history/${userId}`)
      .then((res) => setAttempts(res.data.history || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setFetching(false));
  }, [userId]);

  if (loading || fetching) {
    return (
      <PageLayout title="Aptitude history">
        <PageSkeleton />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Aptitude history"
      description="Review your past aptitude test attempts."
      actions={
        <Button asChild>
          <Link href="/aptitude">New test</Link>
        </Button>
      }
    >
      {error && <ErrorMessage title="Error" message={error} className="mb-6" />}

      {attempts.length === 0 ? (
        <EmptyState
          title="No attempts yet"
          description="Complete an aptitude test to see your history here."
          action={<Button asChild><Link href="/aptitude">Start a test</Link></Button>}
        />
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Link key={attempt._id} href={`/aptitude/review/${attempt._id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base capitalize">
                    {attempt.category || 'Mixed'} · {attempt.testType}
                    {' · '}
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : new Date(attempt.createdAt).toLocaleDateString()}
                  </CardTitle>
                  <CardDescription>
                    {attempt.status === 'completed' ? `Scored ${attempt.score}/${attempt.totalQuestions} (${Math.round(attempt.percentage || 0)}%)` : `Status: ${attempt.status}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground flex gap-4">
                  <span>{attempt.totalQuestions} questions</span>
                  {attempt.totalTimeSeconds != null && (
                    <span>{Math.round(attempt.totalTimeSeconds / 60)} min</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
