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

export default function SystemDesignHistoryPage() {
  const { userId, loading } = useUserId();
  const [attempts, setAttempts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setFetching(true);
    api.get(`/api/system-design/history/${userId}`)
      .then((res) => setAttempts(res.data.history || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setFetching(false));
  }, [userId]);

  if (loading || fetching) {
    return (
      <PageLayout title="System design history">
        <PageSkeleton />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="System design history"
      description="Review your past system design practice attempts."
      actions={
        <Button asChild>
          <Link href="/system-design">New practice</Link>
        </Button>
      }
    >
      {error && <ErrorMessage title="Error" message={error} className="mb-6" />}

      {attempts.length === 0 ? (
        <EmptyState
          title="No attempts yet"
          description="Practice a system design case study to see your history here."
          action={<Button asChild><Link href="/system-design">Start practicing</Link></Button>}
        />
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Link key={attempt._id} href={`/system-design/review/${attempt._id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">
                    {attempt.questionId?.title || 'Untitled'}
                    {' · '}
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : new Date(attempt.createdAt).toLocaleDateString()}
                  </CardTitle>
                  <CardDescription>
                    Scored {attempt.feedback?.overallScore ?? '—'}/100
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground flex gap-4">
                  <span className="capitalize">{attempt.questionId?.difficulty}</span>
                  {attempt.timeSpentSeconds != null && (
                    <span>{Math.round(attempt.timeSpentSeconds / 60)} min</span>
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
