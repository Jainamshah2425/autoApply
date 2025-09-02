---
title: Interview Analysis API
emoji: 🎤
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Interview Analysis FastAPI Service

This is a FastAPI service that provides video analysis and transcription capabilities for interview practice applications.

## Features

- 🎥 **Video Analysis**: Advanced computer vision analysis of interview recordings
- 🔊 **Audio Transcription**: Speech-to-text conversion using multiple recognition engines
- 📊 **Performance Metrics**: Detailed analysis of interview performance
- 🤖 **AI-Powered Feedback**: Intelligent recommendations for improvement

## API Endpoints

### Core Endpoints
- `GET /` - Service information and health status
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation

### Analysis Endpoints
- `POST /analyze-video` - Comprehensive video analysis with transcription
- `POST /transcribe-audio` - Audio-only transcription
- `POST /analyze-face` - Facial expression analysis
- `POST /test-analysis` - Test analysis with sample data

## Usage

This API is designed to work with interview practice applications and provides detailed analysis of video recordings including:

- Speech transcription and clarity analysis
- Facial expression and emotion detection  
- Performance metrics and recommendations
- Real-time feedback for interview improvement

## Technology Stack

- **FastAPI**: Modern, fast web framework for building APIs
- **OpenCV**: Computer vision and image processing
- **MediaPipe**: ML solutions for face and pose detection
- **SpeechRecognition**: Multi-engine speech recognition
- **FFmpeg**: Audio/video processing

## Getting Started

1. Upload a video file to `/analyze-video`
2. Receive comprehensive analysis including transcription and metrics
3. Use the feedback to improve interview performance

For detailed API documentation, visit `/docs` when the service is running.
