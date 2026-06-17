'use client';

import { useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import {
  Loader2, Play, Mic, RefreshCw, HelpCircle, FileText,
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoId: 'python' },
  { id: 'javascript', label: 'JavaScript', monacoId: 'javascript' },
  { id: 'java', label: 'Java', monacoId: 'java' },
  { id: 'cpp', label: 'C++', monacoId: 'cpp' },
];

export default function LiveSession({
  mode,
  modeLabel,
  modeIcon,
  messages,
  userInput,
  setUserInput,
  isLoading,
  isListening,
  setIsListening,
  setError,
  elapsedTime,
  onSend,
  onEnd,
  onRunCode,
  code,
  setCode,
  language,
  setLanguage,
  codeOutput,
  isRunning,
  testResults,
  currentCodingProblem,
}) {
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleSpeech = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
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
        setUserInput((prev) => prev + ' ' + finalTranscript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, setUserInput, setIsListening, setError]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(recognitionRef, setIsListening);
    }
  };

  return (
    <main className="h-screen flex flex-col bg-background text-foreground">
      <Header />

      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize flex items-center gap-1.5">
            <span className="shrink-0 scale-75">{modeIcon}</span> {modeLabel}
          </span>
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5" /> {formatTime(elapsedTime)}
          </span>
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Q{messages.filter((m) => m.role === 'assistant').length}
          </span>
        </div>
        <Button variant="destructive" size="sm" onClick={onEnd} disabled={isLoading}>
          End Interview
        </Button>
      </div>

      <div className={`flex-1 flex overflow-hidden ${mode === 'coding' ? 'flex-row' : 'flex-col'}`}>
        <div className={`flex flex-col bg-background ${mode === 'coding' ? 'w-1/2 border-r border-border' : 'flex-1 mx-auto w-full max-w-4xl'}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => {
              const content =
                typeof msg.content === 'string'
                  ? msg.content
                  : msg.content != null
                    ? JSON.stringify(msg.content, null, 2)
                    : '';

              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card text-card-foreground border border-border rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <span className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        {msg.isFollowUp ? (
                          <><RefreshCw className="w-3 h-3" /> Follow-up</>
                        ) : (
                          <><HelpCircle className="w-3 h-3" /> Question</>
                        )}
                      </span>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card rounded-2xl px-5 py-4 border border-border shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div className="flex items-center gap-3">
              <Button
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleSpeech}
                className={`rounded-full shrink-0 ${isListening ? 'animate-pulse' : ''}`}
                title={isListening ? 'Stop listening' : 'Start speaking'}
              >
                <Mic className="w-4 h-4" />
              </Button>
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening... speak now' : 'Type your answer or use the microphone...'}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none text-sm shadow-sm"
                rows={1}
              />
              <Button
                variant="default"
                onClick={() => onSend(recognitionRef, setIsListening)}
                disabled={!userInput.trim() || isLoading}
                className="rounded-xl px-6"
              >
                Send
              </Button>
            </div>
          </div>
        </div>

        {mode === 'coding' && (
          <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-[#252526]">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#3c3c3c] text-gray-200 text-sm rounded px-3 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary/50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <Button variant="default" size="sm" onClick={onRunCode} disabled={!code.trim() || isRunning}>
                {isRunning ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Run Code</span>
                )}
              </Button>
            </div>

            {currentCodingProblem && (
              <div className="px-4 py-3 bg-[#1e1e1e] border-b border-gray-800 max-h-40 overflow-y-auto">
                <h3 className="text-sm font-semibold text-blue-400 mb-1">{currentCodingProblem.title}</h3>
                <p className="text-xs text-gray-400 mb-2 leading-relaxed">{currentCodingProblem.description}</p>
                {currentCodingProblem.functionSignature && (
                  <div className="mb-2 text-[11px] font-mono p-2 bg-[#2d2d2d] rounded">
                    <span className="text-gray-500 mr-2">def</span>
                    <span className="text-green-300">{currentCodingProblem.functionSignature}</span>
                  </div>
                )}
                {currentCodingProblem.examples?.map((ex, i) => (
                  <div key={i} className="text-[11px] text-gray-400 mt-1">
                    <span className="text-gray-500">Ex {i + 1}:</span> In: <code className="bg-[#2d2d2d] px-1 rounded">{ex.input}</code> → Out: <code className="bg-[#2d2d2d] px-1 rounded">{ex.output}</code>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language={LANGUAGES.find((l) => l.id === language)?.monacoId || 'python'}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                }}
              />
            </div>

            <div className="h-40 border-t border-gray-800 bg-[#1e1e1e] p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-bold tracking-wider">TERMINAL</span>
                {testResults && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${testResults.allPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {testResults.passed}/{testResults.total} passed
                  </span>
                )}
              </div>
              <pre className="text-[13px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {codeOutput || '/> Ready. Run your code to see output...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
