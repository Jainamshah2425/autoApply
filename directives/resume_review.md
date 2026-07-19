# Resume Review — Directive

## Goal
Give authenticated users one-shot structured feedback on their latest uploaded resume using the existing free Groq LLM (`llama-3.3-70b-versatile`).

## Inputs
- Authenticated `userId` (from JWT via `requireAuth`)
- Optional `jobTitle` (string, max 200)
- Optional `jobDescription` (string, max 8000)
- Resume text loaded from MongoDB (`Resume` latest by `createdAt`)

## Outputs
JSON review object:
- `overallScore` (0–100)
- `summary`
- `strengths[]`, `gaps[]`, `atsTips[]`
- `sectionFeedback` `{ contact, experience, skills, education }`

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/llm/review-resume` | Review latest resume; return structured feedback |

## Tools / Scripts
- `backend/services/resumeReview.js` — prompt, parse/normalize, Groq call (`jsonMode`)
- `backend/services/llm.js` — `getLLMResponse` with optional `jsonMode` / circuit breaker
- `backend/routes/llm.js` — route + validation + rate limit
- Frontend: `frontend/app/upload/page.js` — Upload & Apply UI card

## Flow
1. User uploads PDF on `/upload` (existing `POST /api/user/upload-resume`)
2. User optionally enters target job title / JD
3. User clicks **Review resume** → `POST /api/llm/review-resume`
4. Backend loads latest resume; 404 if missing
5. Groq returns JSON; backend normalizes and responds `{ review }`
6. UI renders score, lists, and section notes (not persisted in v1)

## Edge Cases
- No resume uploaded → `404` with message to upload first
- Empty / image-only PDF text → `400` empty resume text
- Invalid LLM JSON → `502` controlled error; user can retry
- Groq rate limit / circuit breaker open → error from `getLLMResponse` / `groqRateLimiter`; wait and retry
- Resume text capped at ~12k chars in the prompt to stay within free-tier limits

## Env
- `GROQ_API_KEY` (already required on Render) — no new secrets

## Learnings
(Updated as the system self-anneals)
