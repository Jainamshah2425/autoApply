from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import tempfile
import logging
import time
import traceback
from typing import Optional
import subprocess
import sys

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Interview Analysis API",
    description="An API to analyze interview performance using AI.",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check dependencies on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Interview Analysis API...")
    
    # Check if ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        logger.info("✓ FFmpeg is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("✗ FFmpeg is not available. Audio extraction will fail.")
    
    # Try to import required modules
    try:
        import speech_recognition as sr
        logger.info("✓ SpeechRecognition is available")
    except ImportError:
        logger.error("✗ SpeechRecognition is not available. Transcription will fail.")
    
    try:
        from analysis import analyze_video
        logger.info("✓ Video analysis module is available")
    except ImportError:
        logger.error("✗ Video analysis module is not available. Video analysis will fail.")

def extract_audio_from_video(video_path: str, audio_path: str) -> bool:
    """Extract audio from video file using ffmpeg"""
    try:
        logger.info(f"Extracting audio from {video_path} to {audio_path}")
        
        # Check if input file exists
        if not os.path.exists(video_path):
            logger.error(f"Input video file does not exist: {video_path}")
            return False
        
        # Check file size
        file_size = os.path.getsize(video_path)
        logger.info(f"Input video file size: {file_size} bytes")
        
        cmd = [
            'ffmpeg', 
            '-i', video_path,
            '-vn',  # no video
            '-acodec', 'pcm_s16le',  # audio codec
            '-ar', '16000',  # sample rate
            '-ac', '1',  # mono
            '-y',  # overwrite output file
            audio_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg failed with return code {result.returncode}")
            logger.error(f"FFmpeg stderr: {result.stderr}")
            return False
        
        # Check if output file was created
        if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
            logger.error("Audio file was not created or is empty")
            return False
        
        logger.info(f"Audio extraction successful. Output file size: {os.path.getsize(audio_path)} bytes")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error("Audio extraction timed out")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during audio extraction: {e}")
        logger.error(traceback.format_exc())
        return False

def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio using speech recognition"""
    try:
        import speech_recognition as sr
        logger.info(f"Transcribing audio from {audio_path}")
        
        # Check if audio file exists and is not empty
        if not os.path.exists(audio_path):
            logger.error(f"Audio file does not exist: {audio_path}")
            return "Audio file not found"
        
        file_size = os.path.getsize(audio_path)
        if file_size == 0:
            logger.error("Audio file is empty")
            return "Audio file is empty"
        
        logger.info(f"Audio file size: {file_size} bytes")
        
        recognizer = sr.Recognizer()
        
        with sr.AudioFile(audio_path) as source:
            # Adjust for ambient noise
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio_data = recognizer.record(source)
            
            # Try Google Speech Recognition first
            try:
                text = recognizer.recognize_google(audio_data, language='en-US')
                logger.info(f"Transcription successful: {len(text)} characters")
                return text
            except sr.UnknownValueError:
                logger.warning("Google Speech Recognition could not understand audio")
                # Try with Sphinx as fallback
                try:
                    text = recognizer.recognize_sphinx(audio_data)
                    logger.info(f"Sphinx transcription successful: {len(text)} characters")
                    return text
                except:
                    return "Could not understand audio (tried multiple engines)"
            except sr.RequestError as e:
                logger.error(f"Google Speech Recognition service error: {e}")
                return f"Speech recognition service error: {e}"
                
    except ImportError:
        logger.error("SpeechRecognition library not available")
        return "Speech recognition library not available"
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        logger.error(traceback.format_exc())
        return f"Error transcribing audio: {e}"

@app.get("/")
def read_root():
    return {"message": "Welcome to the Interview Analysis API", "status": "healthy"}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "API is running",
        "dependencies": {
            "ffmpeg": check_ffmpeg(),
            "speech_recognition": check_speech_recognition(),
            "analysis_module": check_analysis_module()
        }
    }

def check_ffmpeg() -> bool:
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except:
        return False

def check_speech_recognition() -> bool:
    try:
        import speech_recognition
        return True
    except:
        return False

def check_analysis_module() -> bool:
    try:
        from analysis import analyze_video
        return True
    except:
        return False

@app.post("/analyze-video")
async def analyze_video_endpoint(
    video_file: UploadFile = File(...),
    userId: str = Form(...),
    sessionId: str = Form(...),
    questionIndex: str = Form(...),
    questionText: str = Form(...)
):
    """
    Analyzes a video file to extract behavioral metrics and transcription.
    """
    
    logger.info(f"=== NEW VIDEO ANALYSIS REQUEST ===")
    logger.info(f"Session: {sessionId}, Question: {questionIndex}, User: {userId}")
    logger.info(f"Video file: {video_file.filename}, size: {video_file.size if hasattr(video_file, 'size') else 'unknown'}")
    
    # Validate inputs
    if not video_file:
        raise HTTPException(status_code=400, detail="No video file provided")
    
    if not userId or not sessionId or not questionIndex:
        raise HTTPException(status_code=400, detail="Missing required form fields")
    
    temp_video_path = None
    temp_audio_path = None
    
    try:
        # Create temporary files
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_video:
            logger.info("Saving uploaded video to temporary file...")
            shutil.copyfileobj(video_file.file, temp_video)
            temp_video_path = temp_video.name
        
        # Verify video file was saved
        if not os.path.exists(temp_video_path) or os.path.getsize(temp_video_path) == 0:
            raise HTTPException(status_code=400, detail="Failed to save uploaded video file")
        
        logger.info(f"Video saved to: {temp_video_path}, size: {os.path.getsize(temp_video_path)} bytes")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio_path = temp_audio.name
        
        # Step 1: Extract audio
        logger.info("Step 1: Extracting audio from video...")
        audio_extracted = extract_audio_from_video(temp_video_path, temp_audio_path)
        
        # Step 2: Transcribe audio
        transcription = ""
        if audio_extracted and os.path.exists(temp_audio_path):
            logger.info("Step 2: Transcribing audio...")
            transcription = transcribe_audio(temp_audio_path)
        else:
            logger.warning("Audio extraction failed, skipping transcription")
            transcription = "Could not extract or transcribe audio"
        
        # Step 3: Analyze video
        logger.info("Step 3: Analyzing video for behavioral metrics...")
        try:
            from analysis import analyze_video
            analysis_results = analyze_video(temp_video_path)
        except ImportError:
            logger.error("Analysis module not available")
            analysis_results = {"error": "Video analysis module not available"}
        except Exception as e:
            logger.error(f"Video analysis failed: {e}")
            logger.error(traceback.format_exc())
            analysis_results = {"error": f"Video analysis failed: {str(e)}"}
        
        if "error" in analysis_results:
            logger.error(f"Video analysis failed: {analysis_results['error']}")
            # Continue with transcription only
            video_analysis = {
                "duration": 0,
                "speaking_percentage": 0,
                "blinks_per_minute": 0,
                "dominant_gaze": "Unknown",
                "dominant_emotion": "Unknown",
                "total_blinks": 0,
                "total_frames": 0,
                "speaking_frames": 0,
                "confidence_score": 0,
                "engagement_score": 0,
                "error": analysis_results["error"]
            }
        else:
            # Step 4: Process analysis results
            logger.info("Step 4: Processing analysis results...")
            total_frames = analysis_results.get("total_frames", 0)
            speaking_frames = analysis_results.get("speaking_frames", 0)
            
            speaking_percentage = (speaking_frames / total_frames * 100) if total_frames > 0 else 0
            
            fps = 30
            duration_minutes = (total_frames / fps) / 60 if total_frames > 0 else 1
            blinks_per_minute = analysis_results.get("blinks", 0) / duration_minutes if duration_minutes > 0 else 0
            
            gaze_directions = analysis_results.get("gaze", [])
            most_common_gaze = max(set(gaze_directions), key=gaze_directions.count) if gaze_directions else "Unknown"
            
            emotions = analysis_results.get("emotions", [])
            most_common_emotion = max(set(emotions), key=emotions.count) if emotions else "Unknown"
            
            video_analysis = {
                "duration": total_frames / fps if total_frames > 0 else 0,
                "speaking_percentage": round(speaking_percentage, 2),
                "blinks_per_minute": round(blinks_per_minute, 2),
                "dominant_gaze": most_common_gaze,
                "dominant_emotion": most_common_emotion,
                "total_blinks": analysis_results.get("blinks", 0),
                "total_frames": total_frames,
                "speaking_frames": speaking_frames,
                "confidence_score": 85.0,
                "engagement_score": min(100, speaking_percentage + (100 - blinks_per_minute * 2)),
            }
        
        logger.info("Analysis complete. Preparing response...")
        
        response_data = {
            "message": "Analysis complete",
            "transcription": transcription,
            "videoAnalysis": video_analysis,
            "rawResults": analysis_results if "error" not in analysis_results else {},
            "metadata": {
                "userId": userId,
                "sessionId": sessionId,
                "questionIndex": int(questionIndex),
                "questionText": questionText
            }
        }
        
        logger.info(f"Returning response with transcription length: {len(transcription)}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_video_endpoint: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )
    
    finally:
        # Clean up temporary files
        logger.info("Cleaning up temporary files...")
        for path in [temp_video_path, temp_audio_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                    logger.info(f"Deleted temporary file: {path}")
                except Exception as e:
                    logger.warning(f"Could not delete temporary file {path}: {e}")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    return {"error": "Internal server error", "detail": str(exc)}



def extract_audio_fallback(video_path, audio_path):
    try:
        from pydub import AudioSegment
        # This requires FFmpeg but might work better
        video = AudioSegment.from_file(video_path)
        video.export(audio_path, format="wav")
        return True
    except:
        return False
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")