# PrepPilot

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

### Keep-warm (avoiding Render cold starts)

Render free web services spin down after ~15 min of inactivity, so the next
request pays a ~50s cold start. The in-process cron (`backend/cron/keepAlive.js`)
cannot fix this because it dies when the service spins down. An **external**
pinger to `GET /` (the Render health check) is required. Both options below are
$0.

**Option A — GitHub Actions (in-repo, free on public repos)**

The workflow `.github/workflows/keep-warm.yml` pings `GET /` every 10 minutes.

1. Confirm your backend's production URL in the Render dashboard (e.g.
   `https://autoapply-xsj0.onrender.com`).
2. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, name it `BACKEND_URL`, value = your Render URL. (If omitted, the
   workflow falls back to the URL baked into the file.)
3. Test it: **Actions → Keep Backend Warm → Run workflow** and confirm the step
   returns HTTP 200.

Notes: free/unlimited on public repos. On **private** repos this exceeds the
2000 free Actions minutes/month and can incur charges — use Option B instead.
GitHub scheduled runs can drift 5-15 min and are auto-disabled after 60 days of
repo inactivity, so Option B is the more reliable primary/backup.

**Option B — External cron (guaranteed $0 on any repo)**

Use a free uptime/cron service such as [cron-job.org](https://cron-job.org) or
[UptimeRobot](https://uptimerobot.com):

- URL: `https://<your-render-url>/`
- Method: `GET`, interval: every **5-10 minutes**, 24/7
- Expected status: `200`
- Enable failure email alerts (this doubles as uptime monitoring)

Uses zero GitHub minutes, no 60-day disable, and reliable sub-minute scheduling.

## Features

- **AI Interview** — practice with feedback or live behavioral/technical/coding sessions (`/interview`)
- **Aptitude tests** — quant/logical/verbal (`/aptitude`)
- **Job search** — scrape + cover letter + Gmail (`/dashboard`, `/upload`)
- **Profile** — stats and activity heatmap (`/profile`)
