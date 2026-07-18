'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../../components/header';
import { Button } from "@/components/ui/button";
import { BarChart, BookOpen, Brain, Calculator, CheckCircle, ChevronLeft, ChevronRight, Clock, FileText, Target, TrendingUp, Zap, HelpCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useUserId } from '@/hooks/useUserId';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { ErrorMessage } from '@/components/ui/error-message';
import Link from 'next/link';

const CATEGORIES = [
  { id: 'mixed', label: 'Mixed', icon: <Target className="w-8 h-8 text-primary" /> },
  { id: 'quantitative', label: 'Quantitative', icon: <Calculator className="w-8 h-8 text-primary" /> },
  { id: 'logical', label: 'Logical', icon: <Brain className="w-8 h-8 text-primary" /> },
  { id: 'verbal', label: 'Verbal', icon: <FileText className="w-8 h-8 text-primary" /> },
];

const TEST_TYPES = [
  { id: 'practice', label: 'Practice', desc: 'Untimed, see answers after each question', icon: <BookOpen className="w-8 h-8 text-primary" />, questions: 10 },
  { id: 'timed', label: 'Timed Test', desc: '20 questions in 25 minutes', icon: <Clock className="w-8 h-8 text-red-500" />, questions: 20 },
];

export default function AptitudePage() {
  const { userId, loading: userLoading, session } = useUserId();

  // Phase: setup | test | results
  const [phase, setPhase] = useState('setup');

  // Setup state
  const [category, setCategory] = useState('mixed');
  const [testType, setTestType] = useState('practice');
  const [topics, setTopics] = useState([]);
  const [questionCount, setQuestionCount] = useState(0);

  // Test state
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // Results
  const [results, setResults] = useState(null);

  // Analytics
  const [analytics, setAnalytics] = useState(null);
  const questionStartTime = useRef(Date.now());
  const submitRef = useRef(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  useEffect(() => {
    fetchTopics();
    fetchQuestionCount();
    if (userId) fetchAnalytics();
  }, [userId]);

  async function fetchAnalytics() {
    if (!userId) return;
    try {
      const res = await api.get(`/api/aptitude/analytics/${userId}`);
      if (res.data.success) setAnalytics(res.data);
    } catch (err) { console.error(err); }
  }
  useEffect(() => {
    if (phase !== 'test' || testType !== 'timed' || timeLeft == null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submitRef.current?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [attemptId, phase, testType]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  async function fetchTopics() {
    try {
      const res = await api.get('/api/aptitude/topics');
      if (res.data.success) setTopics(res.data.topics);
    } catch (err) { console.error(err); }
  }

  async function fetchQuestionCount() {
    try {
      const res = await api.get('/api/aptitude/question-count');
      if (res.data.success) setQuestionCount(res.data.count);
    } catch (err) { console.error(err); }
  }

  // Start test
  const handleStartTest = async () => {
    if (!userId) { setError('Please log in first.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const config = TEST_TYPES.find(t => t.id === testType);
      const res = await api.post('/api/aptitude/generate-test', {
        userId,
        category,
        questionCount: config.questions,
        testType,
        timeLimitMinutes: testType === 'timed' ? 25 : null
      });
      if (res.data.success) {
        setAttemptId(res.data.attemptId);
        setQuestions(res.data.questions);
        setAnswers({});
        setCurrentIndex(0);
        setShowExplanation(false);
        questionStartTime.current = Date.now();
        if (testType === 'timed') setTimeLeft(25 * 60);
        setPhase('test');
      } else {
        setError(res.data.error || 'Failed to generate test. Run the aptitude seed script first.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Network error.');
    }
    setIsLoading(false);
  };

  // Select answer
  const handleSelect = (optionIndex) => {
    const qId = questions[currentIndex]._id;
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
    setAnswers(prev => ({ ...prev, [qId]: { selectedAnswer: optionIndex, timeSpentSeconds: elapsed } }));
  };

  // Navigate
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      questionStartTime.current = Date.now();
      setShowExplanation(false);
      setCurrentIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      questionStartTime.current = Date.now();
      setShowExplanation(false);
      setCurrentIndex(i => i - 1);
    }
  };

  // Submit
  const handleSubmit = useCallback(async () => {
    clearInterval(timerRef.current);
    setIsLoading(true);
    setError(null);
    try {
      const formattedAnswers = questions.map(q => ({
        questionId: q._id,
        selectedAnswer: answers[q._id]?.selectedAnswer ?? null,
        timeSpentSeconds: answers[q._id]?.timeSpentSeconds || 0
      }));

      const res = await api.post('/api/aptitude/submit', { attemptId, answers: formattedAnswers });
      if (res.data.success) {
        setResults(res.data);
        setPhase('results');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Submission failed.');
    }
    setIsLoading(false);
  }, [questions, answers, attemptId]);

  submitRef.current = handleSubmit;

  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ._id] : null;

  // ─── RENDER: Setup ─────────────────────────────────────────────
  if (userLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <PageSkeleton />
        </div>
      </main>
    );
  }

  if (phase === 'setup') {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          {error && <div className="mb-6"><ErrorMessage title="Error" message={error} /></div>}
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/aptitude/history">View past attempts</Link>
            </Button>
          </div>
          <div className="text-center mb-10">
            <h1 className="text-3xl font-semibold tracking-tight mb-3 flex items-center justify-center gap-3">
              <BarChart className="w-10 h-10 text-primary" /> Aptitude Practice
            </h1>
            <p className="text-muted-foreground text-lg">Practice quant, logical & verbal for placement tests</p>
            {questionCount > 0 ? (
              <p className="text-sm text-muted-foreground mt-2">{questionCount} questions in the bank</p>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Question bank empty — tests will use AI-generated questions.
              </p>
            )}
          </div>

          {/* Analytics Banner */}
          {analytics && analytics.totalTests > 0 && (
            <div className="bg-card rounded-2xl p-5 mb-8 border border-border shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-2xl font-bold text-primary">{analytics.totalTests}</div><div className="text-xs text-muted-foreground">Tests Taken</div></div>
                <div><div className="text-2xl font-bold text-green-500">{analytics.averageScore}%</div><div className="text-xs text-muted-foreground">Avg Score</div></div>
                <div><div className="text-2xl font-bold text-orange-500">{analytics.weakTopics?.length || 0}</div><div className="text-xs text-muted-foreground">Weak Topics</div></div>
              </div>
              {analytics.weakTopics?.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground flex justify-center items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Focus areas: {analytics.weakTopics.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <h2 className="text-lg font-semibold mb-3 text-foreground">Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`p-4 rounded-xl border transition-all text-center
                  ${category === c.id
                    ? 'border-primary bg-primary/10 shadow-lg scale-[1.03]'
                    : 'border-border bg-card hover:border-primary/50'
                  }`}
              >
                <div className="mb-4 flex justify-center">{c.icon}</div>
                <div className="text-sm font-medium text-card-foreground">{c.label}</div>
              </button>
            ))}
          </div>

          {/* Test Type */}
          <h2 className="text-lg font-semibold mb-3 text-foreground">Test Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {TEST_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setTestType(t.id)}
                className={`p-5 rounded-xl border transition-all text-left
                  ${testType === t.id
                    ? 'border-primary bg-primary/10 shadow-lg scale-[1.02]'
                    : 'border-border bg-card hover:border-primary/50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{t.icon}</span>
                  <div>
                    <div className="font-bold text-card-foreground">{t.label}</div>
                    <div className="text-sm text-muted-foreground">{t.desc}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.questions} questions</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="default"
            size="lg"
            onClick={handleStartTest}
            disabled={isLoading || !userId}
            className="w-full py-6 text-lg"
          >
            {isLoading ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-5 h-5 animate-spin"/> Generating...</span> : !userId ? <span className="flex items-center justify-center gap-2"><AlertCircle className="w-5 h-5"/> Log in first</span> : <span className="flex items-center justify-center gap-2"><Zap className="w-5 h-5"/> Start Test</span>}
          </Button>
        </div>
      </main>
    );
  }

  // ─── RENDER: Test ──────────────────────────────────────────────
  if (phase === 'test' && currentQ) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />

        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shadow-sm z-10">
          <span className="text-sm text-muted-foreground">
            Q{currentIndex + 1}/{questions.length} • {answeredCount} answered
          </span>
          {timeLeft !== null && (
            <span className={`text-sm font-mono font-bold flex items-center gap-1.5 ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-green-500'}`}>
              <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
            </span>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isLoading}
          >
            Submit Test
          </Button>
        </div>

        {/* Question */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full capitalize">{currentQ.category}</span>
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">{currentQ.topic}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              currentQ.difficulty === 'easy' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
              currentQ.difficulty === 'hard' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
              'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
            }`}>{currentQ.difficulty}</span>
          </div>

          <h2 className="text-lg font-medium mb-6 leading-relaxed text-foreground">{currentQ.questionText}</h2>

          <div className="space-y-3 mb-6">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all
                  ${currentAnswer?.selectedAnswer === i
                    ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
              >
                <span className={`inline-block w-7 h-7 text-center leading-7 rounded-full text-sm mr-3 font-medium transition-colors ${
                  currentAnswer?.selectedAnswer === i 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>

            {/* Question dots */}
            <div className="flex gap-1 flex-wrap justify-center max-w-xs">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { questionStartTime.current = Date.now(); setShowExplanation(false); setCurrentIndex(i); }}
                  className={`w-7 h-7 text-xs rounded-full transition-all border ${
                    i === currentIndex ? 'bg-primary border-primary text-primary-foreground transform scale-110' :
                    answers[q._id] ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <Button
              variant="default"
              onClick={currentIndex === questions.length - 1 ? () => setShowConfirmSubmit(true) : handleNext}
            >
              {currentIndex === questions.length - 1 ? 'Submit' : 'Next'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {showConfirmSubmit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Submit test?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {answeredCount} of {questions.length} question{questions.length === 1 ? '' : 's'} answered.
                {answeredCount < questions.length && ' Unanswered questions will be marked incorrect.'}
                {' '}You can&apos;t change your answers after submitting.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowConfirmSubmit(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => { setShowConfirmSubmit(false); handleSubmit(); }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ─── RENDER: Results ───────────────────────────────────────────
  if (phase === 'results' && results) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold mb-2 flex items-center justify-center gap-2"><BarChart className="w-8 h-8 text-primary"/> Test Results</h1>
            <p className="text-muted-foreground">
              {results.score}/{results.totalQuestions} correct •
              Avg {results.averageTimePerQuestion}s per question •
              Total {Math.round(results.totalTimeSeconds / 60)} min
            </p>
          </div>

          {/* Score */}
          <div className="bg-card rounded-2xl p-8 mb-6 border border-border text-center shadow-sm">
            <div className={`text-6xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent mb-2 ${
              results.percentage >= 80 ? 'from-green-500 to-emerald-500' :
              results.percentage >= 60 ? 'from-yellow-500 to-orange-500' :
              'from-red-500 to-pink-500'
            }`}>
              {results.percentage}%
            </div>
            <p className="flex items-center justify-center gap-1.5 text-muted-foreground mt-2">
              {results.percentage >= 80 ? <><Zap className="w-5 h-5 text-green-500"/> Excellent!</> :
               results.percentage >= 60 ? <><CheckCircle className="w-5 h-5 text-yellow-500"/> Good effort!</> :
               <><TrendingUp className="w-5 h-5 text-red-500"/> Keep practicing!</>}
            </p>
          </div>

          {/* Topic Breakdown */}
          <div className="bg-card rounded-2xl p-6 mb-6 border border-border shadow-sm">
            <h2 className="font-bold mb-4 text-card-foreground">📋 Topic-wise Breakdown</h2>
            <div className="space-y-3">
              {results.topicBreakdown?.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-40 truncate capitalize">{t.topic.replace(/-/g, ' ')}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.percentage >= 80 ? 'bg-green-500' :
                        t.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${t.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right text-muted-foreground">{t.correct}/{t.total} ({t.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Review */}
          <div className="bg-card rounded-2xl p-6 mb-6 border border-border shadow-sm">
            <h2 className="font-bold mb-4 text-card-foreground flex items-center gap-2"><HelpCircle className="w-5 h-5 text-primary"/> Question Review</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {results.questions?.map((q, i) => (
                <div key={i} className={`p-4 rounded-xl border ${
                  q.skipped ? 'border-border bg-card' :
                  q.isCorrect ? 'border-green-500/20 bg-green-500/10' : 'border-red-500/20 bg-red-500/10'
                }`}>
                  <p className="text-sm mb-2 text-foreground">
                    <span className="font-medium">Q{i + 1}.</span> {q.questionText}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:gap-4 text-xs text-muted-foreground">
                    {q.skipped ? (
                      <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Skipped</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">Your answer: <b className={q.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{q.options?.[q.selectedAnswer]}</b></span>
                        {!q.isCorrect && <span className="flex items-center gap-1">Correct: <b className="text-green-600 dark:text-green-400">{q.options?.[q.correctAnswer]}</b></span>}
                      </>
                    )}
                  </div>
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic flex items-start gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/> {q.explanation}</p>
                  )}
                  {q.shortcutMethod && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1"><Zap className="w-3 h-3"/> Shortcut: {q.shortcutMethod}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

            <Button
            variant="default"
            size="lg"
            onClick={() => { setPhase('setup'); setResults(null); fetchAnalytics(); }}
            className="w-full py-6 text-lg mt-4"
          >
            <RefreshCw className="w-5 h-5 mr-2"/> Take Another Test
          </Button>
        </div>
      </main>
    );
  }

  // Fallback
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <Header />
      <p>Loading...</p>
    </main>
  );
}
