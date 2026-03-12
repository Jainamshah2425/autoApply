'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '../../components/header';
import dynamic from 'next/dynamic';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://autoapply-xsj0.onrender.com';

const MODES = [
  {
    id: 'behavioral',
    label: 'Behavioral',
    icon: '🗣️',
    description: 'HR-style questions using STAR method',
    color: 'from-blue-500 to-blue-700'
  },
  {
    id: 'technical',
    label: 'Technical',
    icon: '🧠',
    description: 'Concepts, system design, domain questions',
    color: 'from-purple-500 to-purple-700'
  },
  {
    id: 'coding',
    label: 'Coding',
    icon: '💻',
    description: 'Live coding with AI code review',
    color: 'from-green-500 to-green-700'
  }
];

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoId: 'python' },
  { id: 'javascript', label: 'JavaScript', monacoId: 'javascript' },
  { id: 'java', label: 'Java', monacoId: 'java' },
  { id: 'cpp', label: 'C++', monacoId: 'cpp' },
];

export default function LiveInterviewPage() {
  const { data: session } = useSession();

  // State — Setup
  const [phase, setPhase] = useState('setup'); // setup | interview | summary
  const [mode, setMode] = useState(null);
  const [jobDescription, setJobDescription] = useState('');

  // State — Interview
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentCodingProblem, setCurrentCodingProblem] = useState(null);

  // State — Code Editor
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // State — Summary
  const [summary, setSummary] = useState(null);

  // State — Timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Refs
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (phase === 'interview') {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Format timer
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── Speech Recognition ────────────────────────────────────────
  const toggleSpeech = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
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
        setUserInput(prev => prev + ' ' + finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // ─── Start Interview ───────────────────────────────────────────
  const handleStart = async () => {
    if (!mode || !jobDescription.trim()) return;

    const userId = session?.user?.id;
    if (!userId) {
      alert('Please log in first.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/live-interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, jobDescription, mode })
      });
      const data = await res.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setMessages([{ role: 'assistant', content: data.message, type: data.questionType }]);
        if (data.codingProblem) setCurrentCodingProblem(data.codingProblem);
        setPhase('interview');
      } else {
        alert(data.error || 'Failed to start interview');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Check your connection and try again.');
    }
    setIsLoading(false);
  };

  // ─── Send Answer ───────────────────────────────────────────────
  const handleSend = async () => {
    const answer = userInput.trim();
    if (!answer || isLoading) return;

    // Stop speech if active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: answer }]);
    setUserInput('');
    setIsLoading(true);

    try {
      const body = { sessionId, answer };

      // If in coding mode and code is present, include code submission
      if (mode === 'coding' && code.trim()) {
        body.codeSubmission = {
          code,
          language,
          executionOutput: codeOutput,
          testResults: testResults?.results || null
        };
      }

      const res = await fetch(`${API_URL}/api/live-interview/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          type: data.questionType,
          isFollowUp: data.isFollowUp
        }]);
        if (data.codingProblem) setCurrentCodingProblem(data.codingProblem);
        if (!data.shouldContinue) {
          // AI wants to end — auto-end the session
          await handleEnd();
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had a technical issue. Could you repeat your answer?',
        type: 'error'
      }]);
    }
    setIsLoading(false);
    inputRef.current?.focus();
  };

  // ─── Run Code ──────────────────────────────────────────────────
  const handleRunCode = async () => {
    if (!code.trim()) return;
    setIsRunning(true);
    setCodeOutput('Running...');
    setTestResults(null);

    try {
      const body = { code, language };
      if (currentCodingProblem?.testCases) {
        body.testCases = currentCodingProblem.testCases;
      }

      const res = await fetch(`${API_URL}/api/live-interview/execute-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.results) {
        // Test case results
        setTestResults(data);
        const summary = `${data.passed}/${data.total} test cases passed`;
        setCodeOutput(summary + '\n\n' + data.results.map((r, i) =>
          `Test ${i + 1}: ${r.passed ? '✅' : '❌'} | Input: ${r.input} | Expected: ${r.expected} | Got: ${r.actual}`
        ).join('\n'));
      } else {
        setCodeOutput(data.output || data.stderr || 'No output');
        if (data.stderr) setCodeOutput(prev => prev + '\n⚠️ ' + data.stderr);
      }
    } catch (err) {
      setCodeOutput('❌ Execution failed: ' + err.message);
    }
    setIsRunning(false);
  };

  // ─── End Interview ─────────────────────────────────────────────
  const handleEnd = async () => {
    clearInterval(timerRef.current);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/live-interview/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data);
        setPhase('summary');
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  // ─── Key handler ───────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── RENDER: Setup Phase ───────────────────────────────────────
  if (phase === 'setup') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              🎙️ Live AI Interview
            </h1>
            <p className="text-gray-400 text-lg">Real-time conversational mock interview with intelligent follow-ups</p>
          </div>

          {/* Mode Selection */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-300">Choose Interview Mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left
                    ${mode === m.id
                      ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/20 scale-[1.02]'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
                    }`}
                >
                  <div className="text-3xl mb-2">{m.icon}</div>
                  <h3 className="text-lg font-bold">{m.label}</h3>
                  <p className="text-sm text-gray-400 mt-1">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Job Description */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Paste Job Description</h2>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the job description here, or describe the role you're preparing for..."
              className="w-full h-40 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-colors"
            />
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={!mode || !jobDescription.trim() || isLoading || !session}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-purple-500/20"
          >
            {isLoading ? '⏳ Starting Interview...' : !session ? '🔒 Please log in first' : '🚀 Start Live Interview'}
          </button>
        </div>
      </main>
    );
  }

  // ─── RENDER: Summary Phase ─────────────────────────────────────
  if (phase === 'summary' && summary) {
    const s = summary.summary || {};
    const cats = s.categoryScores || {};
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold mb-2">📊 Interview Complete</h1>
            <p className="text-gray-400">Duration: {summary.durationMinutes} min • {summary.questionCount} questions</p>
          </div>

          {/* Overall Score */}
          <div className="bg-gray-800/60 rounded-2xl p-8 mb-6 border border-gray-700 text-center">
            <div className="text-6xl font-extrabold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-2">
              {s.overallScore || 0}/10
            </div>
            <p className="text-gray-400">Overall Score</p>
          </div>

          {/* Category Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(cats).map(([key, val]) => (
              <div key={key} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700 text-center">
                <div className="text-2xl font-bold text-blue-400">{val || 0}</div>
                <div className="text-sm text-gray-400 capitalize">{key}</div>
              </div>
            ))}
          </div>

          {/* Feedback */}
          <div className="bg-gray-800/60 rounded-2xl p-6 mb-6 border border-gray-700">
            <h2 className="text-lg font-bold mb-3">💬 Overall Feedback</h2>
            <p className="text-gray-300 leading-relaxed">{s.overallFeedback}</p>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-900/20 rounded-xl p-5 border border-green-800/30">
              <h3 className="font-bold text-green-400 mb-3">✅ Strengths</h3>
              <ul className="space-y-2">
                {(s.strengths || []).map((str, i) => (
                  <li key={i} className="text-gray-300 text-sm">• {str}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-900/20 rounded-xl p-5 border border-red-800/30">
              <h3 className="font-bold text-red-400 mb-3">📈 Improvements</h3>
              <ul className="space-y-2">
                {(s.improvements || []).map((imp, i) => (
                  <li key={i} className="text-gray-300 text-sm">• {imp}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          {s.recommendations && (
            <div className="bg-gray-800/60 rounded-2xl p-6 mb-6 border border-gray-700">
              <h3 className="font-bold mb-3">🎯 Recommendations</h3>
              <ul className="space-y-2">
                {s.recommendations.map((rec, i) => (
                  <li key={i} className="text-gray-300 text-sm">→ {rec}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => { setPhase('setup'); setMessages([]); setSessionId(null); setSummary(null); setElapsedTime(0); setCode(''); setCodeOutput(''); }}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            🔄 Start New Interview
          </button>
        </div>
      </main>
    );
  }

  // ─── RENDER: Interview Phase ───────────────────────────────────
  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white">
      <Header />

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-sm px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full font-medium capitalize">
            {MODES.find(m => m.id === mode)?.icon} {mode}
          </span>
          <span className="text-sm text-gray-400">⏱️ {formatTime(elapsedTime)}</span>
          <span className="text-sm text-gray-400">Q{messages.filter(m => m.role === 'assistant').length}</span>
        </div>
        <button
          onClick={handleEnd}
          disabled={isLoading}
          className="px-4 py-1.5 text-sm bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors font-medium"
        >
          End Interview
        </button>
      </div>

      {/* Main Content — Chat + (optional Code Editor) */}
      <div className={`flex-1 flex overflow-hidden ${mode === 'coding' ? 'flex-row' : 'flex-col'}`}>

        {/* Chat Panel */}
        <div className={`flex flex-col ${mode === 'coding' ? 'w-1/2 border-r border-gray-700' : 'flex-1'}`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' && (
                    <span className="text-xs text-gray-500 block mb-1">
                      {msg.isFollowUp ? '🔄 Follow-up' : '❓ Question'}
                    </span>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className={`p-2.5 rounded-xl transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={isListening ? 'Stop listening' : 'Start speaking'}
              >
                🎤
              </button>
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? '🔴 Listening... speak now' : 'Type your answer or click 🎤 to speak...'}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 outline-none resize-none text-sm"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!userInput.trim() || isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-sm disabled:opacity-40 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Code Editor Panel (coding mode only) */}
        {mode === 'coding' && (
          <div className="w-1/2 flex flex-col bg-gray-900">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 outline-none"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleRunCode}
                disabled={!code.trim() || isRunning}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
              >
                {isRunning ? '⏳ Running...' : '▶ Run Code'}
              </button>
            </div>

            {/* Coding Problem Statement */}
            {currentCodingProblem && (
              <div className="px-3 py-2 bg-gray-800/30 border-b border-gray-700 max-h-32 overflow-y-auto">
                <h3 className="text-sm font-bold text-yellow-400">{currentCodingProblem.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{currentCodingProblem.description}</p>
                {currentCodingProblem.examples?.map((ex, i) => (
                  <div key={i} className="text-xs text-gray-500 mt-1">
                    <span className="text-gray-400">Example {i + 1}:</span> Input: {ex.input} → Output: {ex.output}
                  </div>
                ))}
              </div>
            )}

            {/* Monaco Editor */}
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language={LANGUAGES.find(l => l.id === language)?.monacoId || 'python'}
                theme="vs-dark"
                value={code}
                onChange={val => setCode(val || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  padding: { top: 12 },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Output Console */}
            <div className="h-36 border-t border-gray-700 bg-gray-950 p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 font-medium">OUTPUT</span>
                {testResults && (
                  <span className={`text-xs font-bold ${testResults.allPassed ? 'text-green-400' : 'text-red-400'}`}>
                    {testResults.passed}/{testResults.total} passed
                  </span>
                )}
              </div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                {codeOutput || 'Run your code to see output...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
