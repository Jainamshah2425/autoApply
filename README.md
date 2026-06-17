# AutoApplyAI

AI-powered internship prep: text mock interviews, live AI interviews, aptitude tests, job search, and Gmail applications.

## Local development

### Prerequisites
- Node.js 18+
- MongoDB (Atlas or local)

### 1. Backend (port 5000)
```powershell
cd backend
npm install
copy .env.example .env
# Fill MONGODB_URI, GROQ_API_KEY, GOOGLE_* in .env
npm run dev
```

### 2. Frontend (port 3000)
```powershell
cd frontend
npm install
copy .env.example .env.local
# Fill NEXT_PUBLIC_API_URL, NEXTAUTH_*, GOOGLE_* in .env.local
npm run dev
```

Open http://localhost:3000

### 3. Seed aptitude questions (optional)
```powershell
node execution/seed_aptitude_questions.js
```

## Deployment

| Service | Platform |
|---------|----------|
| Frontend | Vercel (`frontend/`) |
| Backend | Render (`render.yaml`) |
| Database | MongoDB Atlas |

## Features

- **AI Interview** — practice with feedback or live behavioral/technical/coding sessions (`/interview`)
- **Aptitude tests** — quant/logical/verbal (`/aptitude`)
- **Job search** — scrape + cover letter + Gmail (`/dashboard`, `/upload`)
- **Profile** — stats and activity heatmap (`/profile`)
