'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '../../components/header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://autoapply-xsj0.onrender.com';

const CATEGORIES = [
  { id: 'mixed', label: 'Mixed', icon: '🎯', color: 'from-indigo-500 to-purple-600' },
  { id: 'quantitative', label: 'Quantitative', icon: '🔢', color: 'from-blue-500 to-cyan-600' },
  { id: 'logical', label: 'Logical', icon: '🧩', color: 'from-green-500 to-emerald-600' },
  { id: 'verbal', label: 'Verbal', icon: '📝', color: 'from-orange-500 to-red-600' },
];

const TEST_TYPES = [
  { id: 'practice', label: 'Practice', desc: 'Untimed, see answers after each question', icon: '📖', questions: 10 },
  { id: 'timed', label: 'Timed Test', desc: '20 questions in 25 minutes', icon: '⏱️', questions: 20 },
];

export default function AptitudePage() {
  const { data: session } = useSession();

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

  // Timer
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // Results
  const [results, setResults] = useState(null);

  // Analytics
  const [analytics, setAnalytics] = useState(null);
  const [questionTimes, setQuestionTimes] = useState({});
  const questionStartTime = useRef(Date.now());

  // Fetch topics on mount
  useEffect(() => {
    fetchTopics();
    if (session?.user?.id) fetchAnalytics();
  }, [session]);

  // Timer effect
  useEffect(() => {
    if (phase === 'test' && testType === 'timed' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            handleSubmit();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, testType, timeLeft]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  async function fetchTopics() {
    try {
      const res = await fetch(`${API_URL}/api/aptitude/topics`);
      const data = await res.json();
      if (data.success) setTopics(data.topics);
    } catch (err) { console.error(err); }
  }

  async function fetchAnalytics() {
    try {
      const res = await fetch(`${API_URL}/api/aptitude/analytics/${session.user.id}`);
      const data = await res.json();
      if (data.success) setAnalytics(data);
    } catch (err) { console.error(err); }
  }

  async function fetchQuestionCount() {
    try {
      const res = await fetch(`${API_URL}/api/aptitude/question-count`);
      const data = await res.json();
      if (data.success) setQuestionCount(data.count);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { fetchQuestionCount(); }, []);

  // Start test
  const handleStartTest = async () => {
    if (!session?.user?.id) { alert('Please log in first.'); return; }
    setIsLoading(true);
    try {
      const config = TEST_TYPES.find(t => t.id === testType);
      const res = await fetch(`${API_URL}/api/aptitude/generate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          category,
          questionCount: config.questions,
          testType,
          timeLimitMinutes: testType === 'timed' ? 25 : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setAnswers({});
        setCurrentIndex(0);
        setShowExplanation(false);
        questionStartTime.current = Date.now();
        if (testType === 'timed') setTimeLeft(25 * 60);
        setPhase('test');
      } else {
        alert(data.error || 'Failed to generate test. Make sure questions are seeded.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
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
    try {
      const formattedAnswers = questions.map(q => ({
        questionId: q._id,
        selectedAnswer: answers[q._id]?.selectedAnswer ?? null,
        timeSpentSeconds: answers[q._id]?.timeSpentSeconds || 0
      }));

      const res = await fetch(`${API_URL}/api/aptitude/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers: formattedAnswers })
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
        setPhase('results');
      }
    } catch (err) {
      console.error(err);
      alert('Submission failed.');
    }
    setIsLoading(false);
  }, [questions, answers, attemptId]);

  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ._id] : null;

  // ─── RENDER: Setup ─────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              📊 Aptitude Practice
            </h1>
            <p className="text-gray-400 text-lg">Practice quant, logical & verbal for placement tests</p>
            {questionCount > 0 && (
              <p className="text-sm text-gray-500 mt-2">{questionCount} questions in the bank</p>
            )}
          </div>

          {/* Analytics Banner */}
          {analytics && analytics.totalTests > 0 && (
            <div className="bg-gray-800/50 rounded-2xl p-5 mb-8 border border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-2xl font-bold text-blue-400">{analytics.totalTests}</div><div className="text-xs text-gray-500">Tests Taken</div></div>
                <div><div className="text-2xl font-bold text-green-400">{analytics.averageScore}%</div><div className="text-xs text-gray-500">Avg Score</div></div>
                <div><div className="text-2xl font-bold text-orange-400">{analytics.weakTopics?.length || 0}</div><div className="text-xs text-gray-500">Weak Topics</div></div>
              </div>
              {analytics.weakTopics?.length > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  🎯 Focus areas: {analytics.weakTopics.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`p-4 rounded-xl border-2 transition-all text-center
                  ${category === c.id
                    ? 'border-blue-400 bg-blue-500/10 shadow-lg scale-[1.03]'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }`}
              >
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-sm font-medium">{c.label}</div>
              </button>
            ))}
          </div>

          {/* Test Type */}
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Test Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {TEST_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setTestType(t.id)}
                className={`p-5 rounded-xl border-2 transition-all text-left
                  ${testType === t.id
                    ? 'border-purple-400 bg-purple-500/10 shadow-lg scale-[1.02]'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className="font-bold">{t.label}</div>
                    <div className="text-sm text-gray-400">{t.desc}</div>
                    <div className="text-xs text-gray-500 mt-1">{t.questions} questions</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleStartTest}
            disabled={isLoading || !session}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isLoading ? '⏳ Generating...' : !session ? '🔒 Log in first' : '🚀 Start Test'}
          </button>
        </div>
      </main>
    );
  }

  // ─── RENDER: Test ──────────────────────────────────────────────
  if (phase === 'test' && currentQ) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col">
        <Header />

        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm text-gray-400">
            Q{currentIndex + 1}/{questions.length} • {answeredCount} answered
          </span>
          {timeLeft !== null && (
            <span className={`text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
              ⏱️ {formatTime(timeLeft)}
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium"
          >
            Submit Test
          </button>
        </div>

        {/* Question */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full text-gray-300 capitalize">{currentQ.category}</span>
            <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full text-gray-300">{currentQ.topic}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              currentQ.difficulty === 'easy' ? 'bg-green-900/30 text-green-400' :
              currentQ.difficulty === 'hard' ? 'bg-red-900/30 text-red-400' :
              'bg-yellow-900/30 text-yellow-400'
            }`}>{currentQ.difficulty}</span>
          </div>

          <h2 className="text-lg font-medium mb-6 leading-relaxed">{currentQ.questionText}</h2>

          <div className="space-y-3 mb-6">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all
                  ${currentAnswer?.selectedAnswer === i
                    ? 'border-blue-400 bg-blue-500/15 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                  }`}
              >
                <span className="inline-block w-7 h-7 text-center leading-7 rounded-full bg-gray-700 text-sm mr-3 font-medium">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>

            {/* Question dots */}
            <div className="flex gap-1 flex-wrap justify-center max-w-xs">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { questionStartTime.current = Date.now(); setShowExplanation(false); setCurrentIndex(i); }}
                  className={`w-7 h-7 text-xs rounded-full transition-all ${
                    i === currentIndex ? 'bg-blue-500 text-white scale-110' :
                    answers[q._id] ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={currentIndex === questions.length - 1 ? handleSubmit : handleNext}
              className={`px-5 py-2 rounded-lg transition-colors ${
                currentIndex === questions.length - 1
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {currentIndex === questions.length - 1 ? 'Submit →' : 'Next →'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── RENDER: Results ───────────────────────────────────────────
  if (phase === 'results' && results) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold mb-2">📊 Test Results</h1>
            <p className="text-gray-400">
              {results.score}/{results.totalQuestions} correct •
              Avg {results.averageTimePerQuestion}s per question •
              Total {Math.round(results.totalTimeSeconds / 60)} min
            </p>
          </div>

          {/* Score */}
          <div className="bg-gray-800/60 rounded-2xl p-8 mb-6 border border-gray-700 text-center">
            <div className={`text-6xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent mb-2 ${
              results.percentage >= 80 ? 'from-green-400 to-emerald-400' :
              results.percentage >= 60 ? 'from-yellow-400 to-orange-400' :
              'from-red-400 to-pink-400'
            }`}>
              {results.percentage}%
            </div>
            <p className="text-gray-400">
              {results.percentage >= 80 ? '🎉 Excellent!' :
               results.percentage >= 60 ? '👍 Good effort!' :
               '📈 Keep practicing!'}
            </p>
          </div>

          {/* Topic Breakdown */}
          <div className="bg-gray-800/60 rounded-2xl p-6 mb-6 border border-gray-700">
            <h2 className="font-bold mb-4">📋 Topic-wise Breakdown</h2>
            <div className="space-y-3">
              {results.topicBreakdown?.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-40 truncate capitalize">{t.topic.replace(/-/g, ' ')}</span>
                  <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.percentage >= 80 ? 'bg-green-500' :
                        t.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${t.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{t.correct}/{t.total} ({t.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Review */}
          <div className="bg-gray-800/60 rounded-2xl p-6 mb-6 border border-gray-700">
            <h2 className="font-bold mb-4">🔍 Question Review</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {results.questions?.map((q, i) => (
                <div key={i} className={`p-4 rounded-xl border ${
                  q.skipped ? 'border-gray-700 bg-gray-800/30' :
                  q.isCorrect ? 'border-green-800/30 bg-green-900/10' : 'border-red-800/30 bg-red-900/10'
                }`}>
                  <p className="text-sm mb-2">
                    <span className="font-medium">Q{i + 1}.</span> {q.questionText}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    {q.skipped ? (
                      <span className="text-yellow-400">⏭️ Skipped</span>
                    ) : (
                      <>
                        <span>Your answer: <b className={q.isCorrect ? 'text-green-400' : 'text-red-400'}>{q.options?.[q.selectedAnswer]}</b></span>
                        {!q.isCorrect && <span>Correct: <b className="text-green-400">{q.options?.[q.correctAnswer]}</b></span>}
                      </>
                    )}
                  </div>
                  {q.explanation && (
                    <p className="text-xs text-gray-500 mt-2 italic">💡 {q.explanation}</p>
                  )}
                  {q.shortcutMethod && (
                    <p className="text-xs text-cyan-500 mt-1">⚡ Shortcut: {q.shortcutMethod}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setPhase('setup'); setResults(null); fetchAnalytics(); }}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 transition-all"
          >
            🔄 Take Another Test
          </button>
        </div>
      </main>
    );
  }

  // Fallback
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <Header />
      <p>Loading...</p>
    </main>
  );
}
