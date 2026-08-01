'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/page-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { api, getErrorMessage } from '@/lib/api';

export default function SystemDesignReviewPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!attemptId) return;
    api.get(`/api/system-design/attempt/${attemptId}`)
      .then((res) => setAttempt(res.data.attempt))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return (
      <PageLayout title="Attempt review">
        <PageSkeleton />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Attempt review">
        <ErrorMessage title="Error" message={error} />
      </PageLayout>
    );
  }

  const { feedback, questionId: question, answerText } = attempt;

  return (
    <PageLayout
      title={question?.title || 'Attempt review'}
      description={`Scored ${feedback?.overallScore ?? '—'}/100`}
      actions={
        <Button variant="outline" asChild>
          <Link href="/system-design/history">Back to history</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{feedback?.summary}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {(feedback?.strengths || []).map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-green-500">+</span><span>{s}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Gaps</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {(feedback?.gaps || []).map((g, i) => (
                  <li key={i} className="flex gap-2"><span className="text-destructive">−</span><span>{g}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Detailed notes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="font-medium text-foreground">Requirements coverage</p><p className="text-muted-foreground">{feedback?.requirementsCoverage}</p></div>
            <div><p className="font-medium text-foreground">Scalability</p><p className="text-muted-foreground">{feedback?.scalabilityNotes}</p></div>
            <div><p className="font-medium text-foreground">Communication</p><p className="text-muted-foreground">{feedback?.communicationNotes}</p></div>
          </CardContent>
        </Card>

        {question?.referenceApproach?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference approach</CardTitle>
              <CardDescription>Compare against a solid high-level solution.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                {question.referenceApproach.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Your answer</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{answerText}</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
