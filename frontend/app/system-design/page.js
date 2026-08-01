'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ErrorMessage } from '@/components/ui/error-message';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUserId } from '@/hooks/useUserId';
import { api, getErrorMessage } from '@/lib/api';
import { Clock, ListChecks, ArrowLeft } from 'lucide-react';

const FRAMEWORK_STEPS = [
  { label: 'Clarify', hint: 'Ask about scale, users, and edge cases before designing anything.' },
  { label: 'Requirements', hint: 'Pin down functional and non-functional requirements explicitly.' },
  { label: 'High-level design', hint: 'Sketch the main components and how data flows between them.' },
  { label: 'Deep dive', hint: 'Zoom into the trickiest 1-2 components (bottlenecks, trade-offs).' },
  { label: 'Wrap-up', hint: 'Summarize bottlenecks, trade-offs, and what you\'d improve with more time.' },
];

const DIFFICULTY_STYLES = {
  easy: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  hard: 'text-destructive',
};

export default function SystemDesignPage() {
  const { userId, loading: userLoading, session } = useUserId();

  const [phase, setPhase] = useState('browse'); // browse | practice | results
  const [questions, setQuestions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get('/api/system-design/questions')
      .then((res) => setQuestions(res.data.questions || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (phase !== 'practice') return;
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  async function handleSelectQuestion(meta) {
    setError(null);
    try {
      const res = await api.get(`/api/system-design/questions/${meta.slug}`);
      setActiveQuestion(res.data.question);
      setAnswerText('');
      setResult(null);
      setSubmitError(null);
      setElapsedSeconds(0);
      setPhase('practice');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleSubmit() {
    if (!userId) { setSubmitError('Please log in first.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post('/api/system-design/submit', {
        questionId: activeQuestion._id,
        answerText,
        timeSpentSeconds: elapsedSeconds,
      });
      if (res.data.success) {
        setResult(res.data);
        setPhase('results');
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
    setSubmitting(false);
  }

  function backToBrowse() {
    setPhase('browse');
    setActiveQuestion(null);
    setResult(null);
  }

  if (userLoading || fetching) {
    return (
      <PageLayout title="System Design">
        <PageSkeleton />
      </PageLayout>
    );
  }

  if (phase === 'browse') {
    return (
      <PageLayout
        title="System Design"
        description="Practice classic system design case studies and get AI feedback on your approach."
        actions={
          <Button variant="outline" asChild>
            <Link href="/system-design/history">History</Link>
          </Button>
        }
      >
        {error && <ErrorMessage title="Error" message={error} className="mb-6" />}

        {questions.length === 0 ? (
          <EmptyState
            title="No questions available"
            description="Run the system design seed script on the backend to populate case studies."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {questions.map((q) => (
              <Card
                key={q._id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectQuestion(q)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{q.title}</CardTitle>
                  <CardDescription className={`capitalize font-medium ${DIFFICULTY_STYLES[q.difficulty] || ''}`}>
                    {q.difficulty}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(q.keyTopics || []).slice(0, 4).map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    ~{q.estimatedMinutes} min
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageLayout>
    );
  }

  if (phase === 'practice') {
    return (
      <PageLayout
        title={activeQuestion.title}
        description={`~${activeQuestion.estimatedMinutes} min · elapsed ${formatTime(elapsedSeconds)}`}
        actions={
          <Button variant="ghost" size="sm" onClick={backToBrowse}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      >
        {submitError && <ErrorMessage title="Error" message={submitError} className="mb-6" />}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Problem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{activeQuestion.prompt}</p>
                {activeQuestion.functionalRequirements?.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Functional requirements</p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      {activeQuestion.functionalRequirements.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {activeQuestion.nonFunctionalRequirements?.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Non-functional requirements</p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      {activeQuestion.nonFunctionalRequirements.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your design</CardTitle>
                <CardDescription>Write your approach — components, data flow, trade-offs.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Start with clarifying assumptions and requirements, then sketch the high-level design..."
                  className="min-h-80"
                />
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSubmit} disabled={submitting || !answerText.trim()}>
                    {submitting ? 'Grading…' : 'Submit for feedback'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="w-4 h-4" /> Framework
                </CardTitle>
                <CardDescription>The standard structure interviewers expect.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {FRAMEWORK_STEPS.map((step, i) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.hint}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageLayout>
    );
  }

  // phase === 'results'
  const { feedback, referenceApproach } = result;
  return (
    <PageLayout
      title="Feedback"
      description={activeQuestion.title}
      actions={
        <Button variant="outline" onClick={backToBrowse}>
          <ArrowLeft className="w-4 h-4" /> Back to topics
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-medium text-foreground">{feedback.overallScore}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground">{feedback.summary}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-green-500">+</span><span>{s}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Gaps</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {feedback.gaps.map((g, i) => (
                  <li key={i} className="flex gap-2"><span className="text-destructive">−</span><span>{g}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Detailed notes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="font-medium text-foreground">Requirements coverage</p><p className="text-muted-foreground">{feedback.requirementsCoverage}</p></div>
            <div><p className="font-medium text-foreground">Scalability</p><p className="text-muted-foreground">{feedback.scalabilityNotes}</p></div>
            <div><p className="font-medium text-foreground">Communication</p><p className="text-muted-foreground">{feedback.communicationNotes}</p></div>
          </CardContent>
        </Card>

        {referenceApproach?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference approach</CardTitle>
              <CardDescription>Compare against a solid high-level solution.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                {referenceApproach.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
