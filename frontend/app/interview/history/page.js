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

export default function InterviewHistoryPage() {
  const { userId, loading } = useUserId();
  const [sessions, setSessions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setFetching(true);
    api.get(`/api/interview/sessions/user/${userId}`)
      .then((res) => setSessions(res.data.sessions || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setFetching(false));
  }, [userId]);

  if (loading || fetching) {
    return (
      <PageLayout title="Interview history">
        <PageSkeleton />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Interview history"
      description="Review your past mock interview sessions."
      actions={
        <Button asChild>
          <Link href="/interview">New session</Link>
        </Button>
      }
    >
      {error && <ErrorMessage title="Error" message={error} className="mb-6" />}

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Complete a mock interview to see your history here."
          action={<Button asChild><Link href="/interview">Start interview</Link></Button>}
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Card key={session.sessionId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {session.status === 'completed' ? 'Completed session' : 'Session'} · {new Date(session.createdAt).toLocaleDateString()}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {session.jobDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex gap-4">
                <span>{session.questions?.length || 0} questions</span>
                <span>{session.responses?.length || 0} answered</span>
                {session.sessionMetrics?.averageScore != null && (
                  <span>Avg {Math.round(session.sessionMetrics.averageScore)}/10</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
