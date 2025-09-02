---
title: Interview Analysis API
emoji: 🎤
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
hardware: cpu-basic
---

# Interview Analysis FastAPI Service

This is a FastAPI service that provides video analysis and transcription capabilities for interview practice applications.

## Features

- 🎥 Video analysis with facial expression detection
- 🔊 Audio transcription and speech analysis
- 📊 Performance metrics calculation
- 🤖 AI-powered feedback generation
- 📈 Real-time sentiment analysis

## API Endpoints

### Main Endpoints
- `POST /analyze-video` - Comprehensive video analysis
- `POST /transcribe-audio` - Audio transcription only
- `POST /analyze-answer-video` - Interview answer analysis
- `GET /health` - Health check endpoint
- `GET /` - Service information

### Analysis Features
- Facial expression detection
- Speech rate analysis
- Confidence scoring
- Sentiment analysis
- Audio quality metrics

## Usage

The API is designed to work with interview practice applications and provides detailed analysis of video recordings including:

- **Audio Analysis**: Transcription, speech rate, pauses, volume
- **Video Analysis**: Facial expressions, eye contact, head movements
- **Performance Metrics**: Confidence scores, sentiment analysis
- **Feedback Generation**: AI-powered improvement suggestions

## Example Request

```bash
curl -X POST "https://your-space.hf.space/analyze-video" \
  -F "video_file=@recording.webm" \
  -F "userId=user123" \
  -F "sessionId=session456" \
  -F "questionIndex=0" \
  -F "questionText=Tell me about yourself"
```

## Environment Variables

The service uses the following configuration:
- `PORT`: Server port (default: 7860)
- `ENVIRONMENT`: Runtime environment
- `LOG_LEVEL`: Logging level

## Hardware Requirements

- CPU: 2+ cores recommended
- RAM: 4GB+ recommended
- Storage: 2GB+ for models and cache

---

Deployed on Hugging Face Spaces 🚀
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
