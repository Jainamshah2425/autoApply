# Interview Transcription Service

This service handles speech-to-text transcription for interview videos.

## Setup

### Prerequisites

- Node.js (for the backend)
- Python 3.9+ and virtual environment (for the FastAPI service)
- FFmpeg (for audio extraction)

### Installation

1. Set up the Python environment:
   ```bash
   cd backend/fastapi_service
   # Create virtual environment
   python -m venv tr
   
   # Activate virtual environment
   tr\Scripts\activate  # Windows
   source tr/bin/activate  # Linux/Mac
   
   # Install dependencies
   pip install -r requirements.txt
   ```

2. Set up the Node.js backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Create .env file and edit as needed
   ```

### Starting the Services

1. Start the FastAPI service:
   ```bash
   cd backend/fastapi_service
   # On Windows
   .\start_service.bat
   
   # On Linux/Mac
   source tr/bin/activate
   python main.py
   ```

2. Start the Node.js backend:
   ```bash
   cd backend
   npm start  # This will check if FastAPI is running first
   ```

## API Endpoints

### FastAPI Service

- `GET /health` - Health check endpoint
- `POST /api/interview/analyze-video` - Process a video to extract speech transcription

### Node.js Backend

- `POST /api/interview/analyze-video` - Upload and process a video for transcription

## Troubleshooting

### Common Issues

1. **FastAPI Service Not Running:**
   - Check that the FastAPI service is running on port 8000
   - Verify that all Python dependencies are installed
   - Ensure FFmpeg is installed and available in PATH

2. **Audio Extraction Issues:**
   - Check FFmpeg installation
   - Verify the video file format is supported

3. **Transcription Issues:**
   - Check that SpeechRecognition and PyDub are installed
   - Ensure the audio quality is good enough for transcription
