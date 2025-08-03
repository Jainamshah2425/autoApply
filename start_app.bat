@echo off
echo Starting Interview Application...

REM Start FastAPI service
echo Starting FastAPI Transcription Service...
start cmd /k "cd backend\fastapi_service && start_service.bat"

REM Wait for FastAPI to initialize
echo Waiting for FastAPI service to start...
timeout /t 5

REM Start Node.js backend
echo Starting Node.js backend...
start cmd /k "cd backend && npm start"

REM Start frontend
echo Starting React frontend...
start cmd /k "cd frontend && npm run dev"

echo All services started! The application should be available at http://localhost:3000
