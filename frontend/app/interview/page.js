'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import PageLayout from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ErrorMessage } from '@/components/ui/error-message';
import { SuccessMessage } from '@/components/ui/success-message';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUserId } from '@/hooks/useUserId';
import { api, getErrorMessage } from '@/lib/api';
import LiveSession from './live-session';
import {
  Loader2, ClipboardCheck, MessageSquare, Brain, Code, Mic,
  BarChart, MessageCircle, CheckCircle, TrendingUp, Target, RefreshCw, Play,
} from 'lucide-react';

const MODES = [
  {
    id: 'practice',
    label: 'Practice & Feedback',
    icon: <ClipboardCheck className="w-8 h-8 text-primary" />,
    description: 'Structured Q&A with per-answer scoring, strengths, and improved answers',
    flow: 'practice',
  },
  {
    id: 'behavioral',
    label: 'Live Behavioral',
    icon: <MessageSquare className="w-8 h-8 text-primary" />,
    description: 'HR-style conversation with STAR-method follow-ups',
    flow: 'live',
  },
  {
    id: 'technical',
    label: 'Live Technical',
    icon: <Brain className="w-8 h-8 text-primary" />,
    description: 'Concepts, system design, and domain deep-dives',
    flow: 'live',
  },
  {
    id: 'coding',
    label: 'Live Coding',
    icon: <Code className="w-8 h-8 text-primary" />,
    description: 'Live coding with Monaco editor, test cases, and AI review',
    flow: 'live',
  },
];

function getMode(id) {
  return MODES.find((m) => m.id === id);
}

export default function InterviewPage() {
  const { userId, loading: userLoading, session } = useUserId();

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Practice flow
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [improvedAnswer, setImprovedAnswer] = useState('');
  const [practiceInsights, setPracticeInsights] = useState(null);
  const [isListeningPractice, setIsListeningPractice] = useState(false);
  const practiceRecognitionRef = useRef(null);

  // Live flow
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [currentCodingProblem, setCurrentCodingProblem] = useState(null);
  const timerRef = useRef(null);

  const isLiveMode = mode && getMode(mode)?.flow === 'live';
  const isPracticeMode = mode === 'practice';
  const selectedMode = getMode(mode);

  useEffect(() => {
    if (phase === 'active' && isLiveMode) {
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, isLiveMode]);

  useEffect(() => {
    if (!currentCodingProblem) return;
    const starter = currentCodingProblem.starterCode?.[language];
    if (starter && !code.trim()) {
      setCode(starter);
    }
  }, [currentCodingProblem, language, code]);

  function resetSession() {
    setPhase('setup');
    setMode(null);
    setSessionId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswer('');
    setFeedback(null);
    setImprovedAnswer('');
    setPracticeInsights(null);
    setMessages([]);
    setUserInput('');
    setLiveSummary(null);
    setElapsedTime(0);
    setCode('');
    setCodeOutput('');
    setTestResults(null);
    setCurrentCodingProblem(null);
    setError(null);
    setSuccess(null);
  }

  function togglePracticeSpeech() {
    if (isListeningPractice) {
      practiceRecognitionRef.current?.stop();
      setIsListeningPractice(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setAnswer((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
      }
    };
    recognition.onerror = () => setIsListeningPractice(false);
    recognition.onend = () => setIsListeningPractice(false);
    practiceRecognitionRef.current = recognition;
    recognition.start();
    setIsListeningPractice(true);
  }

  async function startSession() {
    if (!mode || !jobDescription.trim()) {
      setError('Choose a mode and paste a job description.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      if (isPracticeMode) {
        const res = await api.post('/api/interview/generate-questions', {
          jobDescription: jobDescription.trim(),
          userId,
        });
        setQuestions(res.data.questions);
        setSessionId(res.data.sessionId);
        setCurrentIndex(0);
        setAnswer('');
        setFeedback(null);
        setImprovedAnswer('');
        setPhase('active');
      } else {
        const res = await api.post('/api/live-interview/start', {
          userId,
          jobDescription: jobDescription.trim(),
          mode,
        });
        const data = res.data;
        if (!data.success) {
          setError(data.error || 'Failed to start interview');
          return;
        }
        setSessionId(data.sessionId);
        setMessages([{ role: 'assistant', content: data.message, type: data.questionType }]);
        if (data.codingProblem) setCurrentCodingProblem(data.codingProblem);
        setElapsedTime(0);
        setPhase('active');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to start session'));
    } finally {
      setBusy(false);
    }
  }

  async function analyzeAnswer() {
    if (!answer.trim() || answer.trim().length < 10) {
      setError('Please write at least 10 characters for your answer.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/api/interview/analyze-answer', {
        question: questions[currentIndex],
        answer: answer.trim(),
        sessionId,
        questionIndex: currentIndex,
        audioMetrics: {
          duration: 0,
          wordsPerMinute: 0,
          wordCount: answer.trim().split(/\s+/).length,
        },
      });
      setFeedback(res.data);
      setSuccess('Answer analyzed successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to analyze answer'));
    } finally {
      setBusy(false);
    }
  }

  async function showImprovedAnswer() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/llm/generate-improved-answer', {
        question: questions[currentIndex],
        answer: answer.trim(),
      });
      setImprovedAnswer(res.data.improvedAnswer || res.data.answer || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate improved answer'));
    } finally {
      setBusy(false);
    }
  }

  async function completePracticeSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/interview/complete-session', { sessionId, userId });
      setPracticeInsights(res.data.insights);
      setPhase('complete');
      setSuccess('Interview session completed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to complete session'));
    } finally {
      setBusy(false);
    }
  }

  async function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnswer('');
      setFeedback(null);
      setImprovedAnswer('');
      setSuccess(null);
      setError(null);
      return;
    }
    await completePracticeSession();
  }

  async function handleLiveSend(recognitionRef, setListening) {
    const text = userInput.trim();
    if (!text || busy) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setListening(false);
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setUserInput('');
    setBusy(true);

    try {
      const body = { sessionId, answer: text };
      if (mode === 'coding' && code.trim()) {
        body.codeSubmission = {
          code,
          language,
          executionOutput: codeOutput,
          testResults: testResults?.results || null,
        };
      }

      const res = await api.post('/api/live-interview/respond', body);
      const data = res.data;

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message,
            type: data.questionType,
            isFollowUp: data.isFollowUp,
          },
        ]);
        if (data.codingProblem) setCurrentCodingProblem(data.codingProblem);
        if (data.questionType === 'closing') {
          await endLiveSession();
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I had a technical issue. Could you repeat your answer?',
          type: 'error',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunCode() {
    if (!code.trim()) return;
    setIsRunning(true);
    setCodeOutput('Running...');
    setTestResults(null);

    try {
      const body = { code, language };
      if (currentCodingProblem?.testCases) {
        body.testCases = currentCodingProblem.testCases;
      }
      const res = await api.post('/api/live-interview/execute-code', body);
      const data = res.data;

      if (data.results) {
        setTestResults(data);
        const summary = `${data.passed}/${data.total} test cases passed`;
        setCodeOutput(
          summary +
            '\n\n' +
            data.results
              .map(
                (r, i) =>
                  `Test ${i + 1}: ${r.passed ? '✅' : '❌'} | Input: ${r.input} | Expected: ${r.expected} | Got: ${r.actual}`
              )
              .join('\n')
        );
      } else {
        setCodeOutput(data.output || data.stderr || 'No output');
        if (data.stderr) setCodeOutput((prev) => prev + '\n⚠️ ' + data.stderr);
      }
    } catch (err) {
      setCodeOutput('❌ Execution failed: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  }

  async function endLiveSession() {
    clearInterval(timerRef.current);
    setBusy(true);
    try {
      const res = await api.post('/api/live-interview/end', { sessionId });
      if (res.data.success) {
        setLiveSummary(res.data);
        setPhase('complete');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to end session'));
    } finally {
      setBusy(false);
    }
  }

  if (userLoading) {
    return (
      <PageLayout title="AI Interview">
        <PageSkeleton />
      </PageLayout>
    );
  }

  if (!session) {
    return (
      <PageLayout title="AI Interview" description="Practice with feedback or simulate a live interview.">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Sign in with Google to start an interview session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn('google')}>Sign in with Google</Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (phase === 'active' && isLiveMode) {
    return (
      <LiveSession
        mode={mode}
        modeLabel={selectedMode?.label}
        modeIcon={selectedMode?.icon}
        messages={messages}
        userInput={userInput}
        setUserInput={setUserInput}
        isLoading={busy}
        isListening={isListening}
        setIsListening={setIsListening}
        setError={setError}
        elapsedTime={elapsedTime}
        onSend={handleLiveSend}
        onEnd={endLiveSession}
        onRunCode={handleRunCode}
        code={code}
        setCode={setCode}
        language={language}
        setLanguage={setLanguage}
        codeOutput={codeOutput}
        isRunning={isRunning}
        testResults={testResults}
        currentCodingProblem={currentCodingProblem}
      />
    );
  }

  return (
    <PageLayout
      title="AI Interview"
      description="Practice with detailed feedback or simulate a real interview — behavioral, technical, or coding."
      actions={
        <Button variant="outline" asChild>
          <Link href="/interview/history">View history</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {error && <ErrorMessage title="Error" message={error} />}
        {success && <SuccessMessage title="Success" message={success} />}

        {phase === 'setup' && (
          <>
            <div>
              <h2 className="text-lg font-semibold mb-4 text-foreground">Choose interview mode</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`p-6 rounded-2xl border transition-all duration-200 text-left ${
                      mode === m.id
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className="mb-3">{m.icon}</div>
                    <h3 className="text-lg font-semibold text-card-foreground">{m.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Job description</CardTitle>
                <CardDescription>
                  Paste the role you are preparing for — questions will be tailored to this JD and your resume.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description here..."
                  rows={8}
                />
                <Button onClick={startSession} disabled={busy || !mode || !jobDescription.trim()} className="w-full sm:w-auto">
                  {busy ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                  ) : isPracticeMode ? (
                    'Generate questions'
                  ) : (
                    <><Play className="w-4 h-4" /> Start live interview</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {phase === 'active' && isPracticeMode && questions.length > 0 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Question {currentIndex + 1} of {questions.length}</CardTitle>
                <CardDescription>{questions[currentIndex]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here, or use the microphone..."
                    rows={8}
                    className="flex-1"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={isListeningPractice ? 'destructive' : 'outline'}
                    size="icon"
                    onClick={togglePracticeSpeech}
                    className={isListeningPractice ? 'animate-pulse' : ''}
                    title="Speech to text"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button onClick={analyzeAnswer} disabled={busy}>
                    {busy ? 'Analyzing...' : 'Analyze answer'}
                  </Button>
                  {feedback && (
                    <>
                      <Button variant="secondary" onClick={showImprovedAnswer} disabled={busy}>
                        Show improved answer
                      </Button>
                      <Button variant="outline" onClick={nextQuestion} disabled={busy}>
                        {currentIndex < questions.length - 1 ? 'Next question' : 'Finish session'}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {feedback && (
              <Card>
                <CardHeader>
                  <CardTitle>Feedback</CardTitle>
                  <CardDescription>
                    Score: {feedback.overallScore ?? feedback.score ?? 'N/A'}/10
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {feedback.feedback && <p>{feedback.feedback}</p>}
                  {feedback.strengths?.length > 0 && (
                    <div>
                      <p className="font-medium text-foreground mb-1">Strengths</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {feedback.improvements?.length > 0 && (
                    <div>
                      <p className="font-medium text-foreground mb-1">Improvements</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {improvedAnswer && (
              <Card>
                <CardHeader>
                  <CardTitle>Improved answer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{improvedAnswer}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {phase === 'complete' && isPracticeMode && practiceInsights && (
          <Card>
            <CardHeader>
              <CardTitle>Session complete</CardTitle>
              <CardDescription>{practiceInsights.overallAssessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {practiceInsights.metrics && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Avg score</p>
                    <p className="text-xl font-medium">{practiceInsights.metrics.averageScore ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="text-xl font-medium">
                      {practiceInsights.metrics.completedQuestions ?? 0}/{practiceInsights.metrics.totalQuestions ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completion</p>
                    <p className="text-xl font-medium">{Math.round(practiceInsights.metrics.completionRate ?? 0)}%</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={resetSession}>Start new session</Button>
                <Button variant="outline" asChild>
                  <Link href="/interview/history">View history</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === 'complete' && isLiveMode && liveSummary && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-1 flex items-center justify-center gap-2">
                <BarChart className="w-6 h-6 text-primary" /> Interview complete
              </h2>
              <p className="text-muted-foreground text-sm">
                Duration: {liveSummary.durationMinutes} min • {liveSummary.questionCount} questions
              </p>
            </div>

            {(() => {
              const s = liveSummary.summary || {};
              const cats = s.categoryScores || {};
              return (
                <>
                  <Card className="text-center mb-6">
                    <CardContent className="pt-6">
                      <div className="text-5xl font-bold text-primary mb-1">{s.overallScore || 0}/10</div>
                      <p className="text-muted-foreground">Overall score</p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(cats).map(([key, val]) => (
                      <Card key={key} className="text-center">
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold text-primary">{val || 0}</div>
                          <div className="text-sm text-muted-foreground capitalize">{key}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageCircle className="w-5 h-5 text-primary" /> Overall feedback
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{s.overallFeedback}</p>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <Card className="border-green-500/20 bg-green-500/5">
                      <CardHeader>
                        <CardTitle className="text-green-600 dark:text-green-400 text-base flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" /> Strengths
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {(s.strengths || []).map((str, i) => (
                            <li key={i} className="text-green-700 dark:text-green-300 text-sm">{str}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400 text-base flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" /> Improvements
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {(s.improvements || []).map((imp, i) => (
                            <li key={i} className="text-red-700 dark:text-red-300 text-sm">{imp}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {s.recommendations?.length > 0 && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" /> Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {s.recommendations.map((rec, i) => (
                            <li key={i} className="text-muted-foreground text-sm flex items-start gap-2">
                              <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}

            <Button onClick={resetSession} className="w-full sm:w-auto">
              <RefreshCw className="w-4 h-4" /> Start new session
            </Button>
          </>
        )}
      </div>
    </PageLayout>
  );
}
