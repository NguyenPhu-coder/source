"""
Avatar Teacher Agent
Provides 3D avatar-based interactive teaching with TTS and gesture control
"""

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import asyncio
import os
import json
from datetime import datetime
import hashlib

# TTS libraries
from gtts import gTTS
import tempfile

app = FastAPI(title="Avatar Teacher Agent", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for 3D models
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
if os.path.exists(MODELS_DIR):
    app.mount("/avatars", StaticFiles(directory=MODELS_DIR), name="avatars")

# Models
class SpeechRequest(BaseModel):
    text: str
    language: str = "en"
    speed: float = 1.0
    voice_type: str = "neutral"

class LessonPresentationRequest(BaseModel):
    lesson_id: int
    content: str
    language: str = "en"
    voice_type: str = "neutral"
    speed: float = 1.0

class TimelineItem(BaseModel):
    time: int
    gesture: str
    emotion: str
    text: str

class PresentationResponse(BaseModel):
    lesson_id: int
    audio_url: str
    timeline: List[TimelineItem]
    duration: int
    subtitles: List[Dict[str, any]]

class AvatarCustomization(BaseModel):
    user_id: int
    avatar_model: str = "default_teacher"
    voice_type: str = "neutral"
    voice_speed: float = 1.0
    language: str = "en"
    gesture_enabled: bool = True
    subtitle_enabled: bool = True

# Storage for audio files
AUDIO_DIR = tempfile.gettempdir() + "/avatar_audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

# Gesture definitions
GESTURES = {
    "neutral": {"name": "Neutral", "duration": 0, "animation": "idle"},
    "wave": {"name": "Wave", "duration": 2000, "animation": "wave"},
    "point": {"name": "Point", "duration": 3000, "animation": "pointing"},
    "thinking": {"name": "Thinking", "duration": 2000, "animation": "scratch_head"},
    "congratulate": {"name": "Congratulate", "duration": 2000, "animation": "thumbs_up"},
    "encourage": {"name": "Encourage", "duration": 2000, "animation": "clap"},
    "explain": {"name": "Explain", "duration": 4000, "animation": "presenting"},
    "question": {"name": "Question", "duration": 2500, "animation": "questioning"}
}

# Emotion definitions
EMOTIONS = {
    "neutral": {"intensity": 0.5},
    "happy": {"intensity": 0.8},
    "thinking": {"intensity": 0.6},
    "excited": {"intensity": 0.9},
    "concerned": {"intensity": 0.7},
    "confident": {"intensity": 0.85}
}

def analyze_content_for_gestures(content: str) -> List[Dict]:
    """
    Analyze lesson content to determine appropriate gestures
    """
    sentences = content.split('. ')
    timeline = []
    current_time = 0
    
    for idx, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # Estimate speech duration (average 150 words per minute)
        word_count = len(sentence.split())
        duration = int((word_count / 150) * 60 * 1000)  # milliseconds
        
        # Determine gesture based on content
        gesture = "neutral"
        emotion = "neutral"
        
        if idx == 0:
            gesture = "wave"
            emotion = "happy"
        elif "?" in sentence:
            gesture = "question"
            emotion = "thinking"
        elif any(word in sentence.lower() for word in ["important", "key", "remember", "note"]):
            gesture = "point"
            emotion = "confident"
        elif any(word in sentence.lower() for word in ["let's", "we will", "now"]):
            gesture = "explain"
            emotion = "confident"
        elif any(word in sentence.lower() for word in ["great", "good", "excellent", "congratulations"]):
            gesture = "congratulate"
            emotion = "excited"
        elif any(word in sentence.lower() for word in ["think", "consider", "imagine"]):
            gesture = "thinking"
            emotion = "thinking"
        
        timeline.append({
            "time": current_time,
            "gesture": gesture,
            "emotion": emotion,
            "text": sentence
        })
        
        current_time += duration
    
    return timeline, current_time

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "avatar-teacher",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/synthesize-speech")
async def synthesize_speech(request: SpeechRequest):
    """
    Convert text to speech
    """
    try:
        # Generate unique filename
        text_hash = hashlib.md5(request.text.encode()).hexdigest()
        filename = f"speech_{text_hash}_{request.language}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        # Check if already generated
        if not os.path.exists(filepath):
            # Generate speech using gTTS
            tts = gTTS(text=request.text, lang=request.language, slow=(request.speed < 1.0))
            tts.save(filepath)
        
        return {
            "success": True,
            "audio_url": f"/api/audio/{filename}",
            "duration": estimate_audio_duration(request.text),
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """
    Serve audio file
    """
    filepath = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath, media_type="audio/mpeg")

@app.post("/api/present-lesson", response_model=PresentationResponse)
async def present_lesson(request: LessonPresentationRequest):
    """
    Create a complete lesson presentation with timeline, audio, and gestures
    """
    try:
        # Analyze content for gestures
        timeline, total_duration = analyze_content_for_gestures(request.content)
        
        # Generate speech
        text_hash = hashlib.md5(request.content.encode()).hexdigest()
        filename = f"lesson_{request.lesson_id}_{text_hash}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)
        
        if not os.path.exists(filepath):
            tts = gTTS(text=request.content, lang=request.language, slow=(request.speed < 1.0))
            tts.save(filepath)
        
        # Create subtitles
        subtitles = [
            {
                "start": item["time"],
                "end": item["time"] + estimate_audio_duration(item["text"]),
                "text": item["text"]
            }
            for item in timeline
        ]
        
        return PresentationResponse(
            lesson_id=request.lesson_id,
            audio_url=f"/api/audio/{filename}",
            timeline=[TimelineItem(**item) for item in timeline],
            duration=total_duration,
            subtitles=subtitles
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lesson presentation failed: {str(e)}")

@app.get("/api/avatar/gestures")
async def get_gestures():
    """
    Get available gestures
    """
    return {
        "success": True,
        "gestures": [
            {"id": key, **value}
            for key, value in GESTURES.items()
        ]
    }

@app.get("/api/avatar/emotions")
async def get_emotions():
    """
    Get available emotions
    """
    return {
        "success": True,
        "emotions": [
            {"id": key, **value}
            for key, value in EMOTIONS.items()
        ]
    }

@app.post("/api/avatar/customize")
async def customize_avatar(customization: AvatarCustomization):
    """
    Save user avatar customization preferences
    """
    try:
        # In production, save to database
        # For now, return success
        return {
            "success": True,
            "message": "Avatar customization saved",
            "preferences": customization.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Customization failed: {str(e)}")

@app.get("/api/avatar/models")
async def get_avatar_models():
    """
    Get available avatar models
    """
    return {
        "success": True,
        "models": [
            {
                "id": "default_teacher",
                "name": "Default Teacher",
                "description": "Professional teacher avatar",
                "preview_url": "/avatars/default_teacher.png",
                "model_url": "/avatars/default_teacher.glb"
            },
            {
                "id": "casual_teacher",
                "name": "Casual Teacher",
                "description": "Friendly and approachable teacher",
                "preview_url": "/avatars/casual_teacher.png",
                "model_url": "/avatars/casual_teacher.glb"
            },
            {
                "id": "formal_teacher",
                "name": "Formal Teacher",
                "description": "Traditional formal educator",
                "preview_url": "/avatars/formal_teacher.png",
                "model_url": "/avatars/formal_teacher.glb"
            }
        ]
    }

def estimate_audio_duration(text: str) -> int:
    """
    Estimate audio duration in milliseconds based on text length
    Average speaking rate: 150 words per minute
    """
    word_count = len(text.split())
    duration_seconds = (word_count / 150) * 60
    return int(duration_seconds * 1000)

@app.get("/api/stats")
async def get_stats():
    """
    Get agent statistics
    """
    audio_files = len([f for f in os.listdir(AUDIO_DIR) if f.endswith('.mp3')])
    
    return {
        "success": True,
        "stats": {
            "total_audio_files": audio_files,
            "available_gestures": len(GESTURES),
            "available_emotions": len(EMOTIONS),
            "supported_languages": ["en", "vi", "es", "fr", "de", "ja", "ko", "zh"]
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8019))
    uvicorn.run(app, host="0.0.0.0", port=port)
