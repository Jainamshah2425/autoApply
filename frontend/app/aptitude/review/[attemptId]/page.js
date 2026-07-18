'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { api, getErrorMessage } from '@/lib/api';
import { CheckCircle, XCircle } from 'lucide-react';

export default function AptitudeReviewPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!attemptId) return;
    api.get(`/api/aptitude/attempt/${attemptId}`)
      .then((res) => {
        setAttempt(res.data.attempt);
        setReviewData(res.data.reviewData || []);
      })
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

  return (
    <PageLayout
      title="Attempt review"
      description={attempt ? `${attempt.category || 'Mixed'} · Scored ${attempt.score}/${attempt.totalQuestions} (${Math.round(attempt.percentage || 0)}%)` : undefined}
      actions={
        <Button variant="outline" asChild>
          <Link href="/aptitude/history">Back to history</Link>
        </Button>
      }
    >
      {(!reviewData || reviewData.length === 0) ? (
        <ErrorMessage title="Not available" message="Review details aren't available for this attempt." />
      ) : (
        <div className="space-y-4">
          {reviewData.map((q, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base flex items-start gap-2">
                  {q.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <span>Q{i + 1}. {q.questionText}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="space-y-1">
                  {(q.options || []).map((opt, oi) => (
                    <div
                      key={oi}
                      className={`px-3 py-2 rounded-lg border ${
                        oi === q.correctAnswer ? 'border-green-500 bg-green-500/10' :
                        oi === q.selectedAnswer ? 'border-destructive bg-destructive/10' :
                        'border-border'
                      }`}
                    >
                      {opt}
                      {oi === q.correctAnswer && <span className="ml-2 text-xs text-green-600 dark:text-green-400">Correct answer</span>}
                      {oi === q.selectedAnswer && oi !== q.correctAnswer && <span className="ml-2 text-xs text-destructive">Your answer</span>}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-muted-foreground pt-2">{q.explanation}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
