# Live AI Interview — Directive

## Goal
Provide a real-time, conversational mock interview experience where the AI asks questions, the user answers via speech or text, and the AI generates intelligent follow-up questions. Supports three modes: **Behavioral**, **Technical**, and **Coding**.

## Inputs
- `userId` — authenticated user
- `jobDescription` — pasted JD or selected role template
- `mode` — one of `behavioral`, `technical`, `coding`
- User's resume (fetched from DB)

## Architecture
- **Backend**: Express routes + SSE streaming for real-time responses
- **LLM**: Groq API (`llama-3.3-70b-versatile`) with conversation history
- **Code Execution**: Piston API (`https://emkc.org/api/v2/piston/execute`)
- **Speech**: Web Speech API (browser-native, free)
- **Editor**: Monaco Editor (`@monaco-editor/react`)

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/live-interview/start` | Start session, get first question |
| POST | `/api/live-interview/respond` | Submit answer, get AI follow-up (SSE stream) |
| POST | `/api/live-interview/execute-code` | Run code via Piston API |
| POST | `/api/live-interview/end` | End session, get summary |
| GET  | `/api/live-interview/session/:id` | Retrieve session details |

## Conversation Flow
1. System prompt sets the interviewer persona + JD + resume context
2. AI asks first question based on mode
3. User answers → AI decides: ask a follow-up OR move to next topic
4. After 8-12 questions, AI wraps up and generates session summary
5. Summary includes: overall score, per-question breakdown, strengths, improvements

## Edge Cases
- User disconnects mid-session → session saved as `interrupted`, resumable
- LLM fails → graceful fallback: "Let me rephrase that question..."
- Piston API down → show error, allow retry, don't block interview
- Empty answer → prompt user to try again, don't score

## Scripts Used
- `backend/services/liveInterviewService.js` — conversation orchestration
- `backend/services/codeExecutionService.js` — Piston API wrapper
- `backend/routes/liveInterview.js` — Express routes

## Learnings
(Updated as the system self-anneals)
