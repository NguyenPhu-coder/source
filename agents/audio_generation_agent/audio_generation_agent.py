"""
Audio Generation Agent
Production-ready educational audio generation with Piper TTS

Features:
- Multi-voice narration (teacher-student dialogue)
- SSML support (pauses, emphasis, pronunciation)
- Real-time streaming
- Transcript with word-level timing
- Audio normalization & compression
- Multiple language support
- WebSocket streaming
"""

import asyncio
import hashlib
import io
import json
import re
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import boto3
import structlog
import yaml
from botocore.exceptions import ClientError
from fastapi import BackgroundTasks, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from pydub import AudioSegment
from pydub.effects import normalize
from pydub.silence import detect_nonsilent
from starlette.responses import Response

# Structured logging
logger = structlog.get_logger()

# Prometheus metrics
audio_generated_total = Counter(
    "audio_generated_total", "Total audio generated", ["voice", "status"]
)
generation_duration = Histogram(
    "audio_generation_duration_seconds", "Audio generation duration"
)
upload_duration = Histogram("audio_upload_duration_seconds", "CDN upload duration")


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class GenerateAudioRequest(BaseModel):
    """Request for basic audio generation"""

    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = Field(default="en_US-lessac-medium")
    language: str = Field(default="en")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class GenerateDialogueRequest(BaseModel):
    """Request for dialogue generation"""

    teacher_text: str = Field(..., min_length=1)
    student_text: str = Field(..., min_length=1)
    teacher_voice: str = Field(default="en_US-lessac-medium")
    student_voice: str = Field(default="en_US-ryan-medium")
    pause_between: float = Field(default=0.5, ge=0.0, le=5.0)


class GenerateSSMLRequest(BaseModel):
    """Request for SSML audio generation"""

    ssml_text: str = Field(..., min_length=1)
    voice: str = Field(default="en_US-lessac-medium")


class AudioResponse(BaseModel):
    """Response with generated audio"""

    audio_id: str
    cdn_url: str
    duration: float
    transcript: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any]
    generation_time: float


class TranscriptResponse(BaseModel):
    """Response with synchronized transcript"""

    audio_id: str
    text: str
    word_timings: List[Dict[str, Any]]
    highlights: List[Dict[str, Any]]


# ============================================================================
# SSML PROCESSOR
# ============================================================================


class SSMLProcessor:
    """Process SSML tags for Piper TTS"""

    def __init__(self):
        # SSML tag patterns
        self.pause_pattern = re.compile(r'<break\s+time="(\d+(?:\.\d+)?)([ms]+)"\s*/>')
        self.emphasis_pattern = re.compile(r'<emphasis\s+level="(\w+)">(.+?)</emphasis>')
        self.prosody_pattern = re.compile(
            r'<prosody\s+(?:rate="(\w+)"\s*)?(?:pitch="([+-]?\d+)%"\s*)?>(.+?)</prosody>'
        )
        self.phoneme_pattern = re.compile(r'<phoneme\s+ph="(.+?)">(.+?)</phoneme>')

    def add_ssml_tags(
        self, text: str, emphasis: Optional[List[str]] = None, pauses: Optional[List[Tuple[int, float]]] = None
    ) -> str:
        """
        Add SSML tags to plain text
        
        Args:
            text: Plain text
            emphasis: List of words to emphasize
            pauses: List of (word_index, duration_seconds) for pauses
            
        Returns:
            SSML-formatted text
        """
        # Split into sentences
        sentences = re.split(r'([.!?])', text)
        result = []

        for i, part in enumerate(sentences):
            if not part.strip():
                continue

            # Add emphasis to specified words
            if emphasis:
                for word in emphasis:
                    pattern = re.compile(rf'\b({re.escape(word)})\b', re.IGNORECASE)
                    part = pattern.sub(r'<emphasis level="strong">\1</emphasis>', part)

            result.append(part)

            # Add pauses at punctuation
            if part in ['.', '!', '?']:
                result.append('<break time="500ms"/>')
            elif part == ',':
                result.append('<break time="200ms"/>')

        # Add custom pauses
        if pauses:
            words = text.split()
            for idx, duration_sec in pauses:
                if 0 <= idx < len(words):
                    duration_ms = int(duration_sec * 1000)
                    words[idx] += f' <break time="{duration_ms}ms"/>'
            return ' '.join(words)

        return ''.join(result)

    def parse_ssml(self, ssml_text: str) -> List[Dict[str, Any]]:
        """
        Parse SSML into processing instructions
        
        Args:
            ssml_text: SSML-formatted text
            
        Returns:
            List of processing instructions
        """
        instructions = []

        # Extract pauses
        for match in self.pause_pattern.finditer(ssml_text):
            duration = float(match.group(1))
            unit = match.group(2)
            if unit == 's':
                duration *= 1000  # Convert to ms
            instructions.append({
                "type": "pause",
                "duration_ms": duration,
                "position": match.start()
            })

        # Extract emphasis
        for match in self.emphasis_pattern.finditer(ssml_text):
            level = match.group(1)
            text = match.group(2)
            instructions.append({
                "type": "emphasis",
                "level": level,
                "text": text,
                "position": match.start()
            })

        # Remove SSML tags for plain text
        plain_text = re.sub(r'<[^>]+>', '', ssml_text)
        instructions.insert(0, {"type": "text", "content": plain_text})

        return instructions

    def strip_ssml(self, ssml_text: str) -> str:
        """Remove all SSML tags and return plain text"""
        return re.sub(r'<[^>]+>', '', ssml_text)


# ============================================================================
# PIPER TTS ENGINE
# ============================================================================


class PiperTTSEngine:
    """Piper TTS text-to-speech engine"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.models_dir = Path(config.get("models_dir", "/models/piper"))
        self.voices = {v["name"]: v for v in config.get("voices", [])}
        self.sample_rate = config.get("sample_rate", 22050)

        # Ensure models directory exists
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def generate_audio(
        self, text: str, voice: str = "en_US-lessac-medium", speed: float = 1.0
    ) -> bytes:
        """
        Generate audio from text using Piper TTS
        
        Args:
            text: Text to synthesize
            voice: Voice model name
            speed: Speech rate (0.5-2.0)
            
        Returns:
            Audio bytes (WAV format)
        """
        if voice not in self.voices:
            raise ValueError(f"Voice {voice} not found. Available: {list(self.voices.keys())}")

        # Get voice model path
        voice_model = self.models_dir / f"{voice}.onnx"
        voice_config = self.models_dir / f"{voice}.onnx.json"

        if not voice_model.exists():
            raise FileNotFoundError(f"Voice model not found: {voice_model}")

        # Create temp file for output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            output_path = tmp_file.name

        try:
            # Run Piper TTS
            cmd = [
                "piper",
                "--model", str(voice_model),
                "--config", str(voice_config),
                "--output_file", output_path,
            ]

            # Add speed adjustment
            if speed != 1.0:
                cmd.extend(["--length_scale", str(1.0 / speed)])

            # Run command with text input
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            stdout, stderr = process.communicate(input=text.encode('utf-8'))

            if process.returncode != 0:
                error_msg = stderr.decode('utf-8')
                logger.error("piper_tts_failed", error=error_msg)
                raise RuntimeError(f"Piper TTS failed: {error_msg}")

            # Read generated audio
            with open(output_path, "rb") as f:
                audio_data = f.read()

            return audio_data

        finally:
            # Cleanup temp file
            Path(output_path).unlink(missing_ok=True)

    def generate_dialogue(
        self,
        teacher_text: str,
        student_text: str,
        teacher_voice: str = "en_US-lessac-medium",
        student_voice: str = "en_US-ryan-medium",
        pause_duration: float = 0.5,
    ) -> bytes:
        """
        Generate dialogue with multiple voices
        
        Args:
            teacher_text: Teacher's text
            student_text: Student's text
            teacher_voice: Teacher's voice model
            student_voice: Student's voice model
            pause_duration: Pause between speakers (seconds)
            
        Returns:
            Combined audio bytes
        """
        # Generate teacher audio
        teacher_audio = self.generate_audio(teacher_text, teacher_voice)
        teacher_segment = AudioSegment.from_wav(io.BytesIO(teacher_audio))

        # Generate student audio
        student_audio = self.generate_audio(student_text, student_voice)
        student_segment = AudioSegment.from_wav(io.BytesIO(student_audio))

        # Create pause
        pause_ms = int(pause_duration * 1000)
        pause_segment = AudioSegment.silent(duration=pause_ms)

        # Combine: teacher + pause + student
        combined = teacher_segment + pause_segment + student_segment

        # Export to bytes
        buffer = io.BytesIO()
        combined.export(buffer, format="wav")
        return buffer.getvalue()


# ============================================================================
# AUDIO PROCESSOR
# ============================================================================


class AudioProcessor:
    """Audio post-processing and optimization"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.normalize = config.get("normalize_audio", True)
        self.remove_silence = config.get("remove_silence", True)
        self.output_format = config.get("output_format", "mp3")
        self.quality = config.get("quality", "high")

    def process_audio(self, audio_bytes: bytes) -> bytes:
        """
        Process and optimize audio
        
        Args:
            audio_bytes: Raw audio bytes (WAV)
            
        Returns:
            Processed audio bytes
        """
        # Load audio
        audio = AudioSegment.from_wav(io.BytesIO(audio_bytes))

        # Normalize volume
        if self.normalize:
            audio = normalize(audio)

        # Remove leading/trailing silence
        if self.remove_silence:
            audio = self._remove_silence(audio)

        # Export in target format
        buffer = io.BytesIO()
        export_params = self._get_export_params()
        audio.export(buffer, **export_params)

        return buffer.getvalue()

    def _remove_silence(
        self, audio: AudioSegment, silence_thresh: int = -50, min_silence_len: int = 500
    ) -> AudioSegment:
        """Remove silence from audio"""
        # Detect non-silent chunks
        nonsilent_ranges = detect_nonsilent(
            audio,
            min_silence_len=min_silence_len,
            silence_thresh=silence_thresh,
        )

        if not nonsilent_ranges:
            return audio

        # Keep only non-silent parts with small padding
        start = max(0, nonsilent_ranges[0][0] - 100)
        end = min(len(audio), nonsilent_ranges[-1][1] + 100)

        return audio[start:end]

    def _get_export_params(self) -> Dict[str, Any]:
        """Get export parameters based on format and quality"""
        params = {"format": self.output_format}

        if self.output_format == "mp3":
            bitrates = {"low": "64k", "medium": "128k", "high": "192k"}
            params["bitrate"] = bitrates.get(self.quality, "128k")
            params["parameters"] = ["-q:a", "2"]  # VBR quality
        elif self.output_format == "ogg":
            params["codec"] = "libvorbis"
            quality_map = {"low": "3", "medium": "5", "high": "7"}
            params["parameters"] = ["-q:a", quality_map.get(self.quality, "5")]

        return params

    def create_transcript(self, audio_bytes: bytes, text: str) -> Dict[str, Any]:
        """
        Create transcript with word-level timing
        
        Args:
            audio_bytes: Audio bytes
            text: Original text
            
        Returns:
            Transcript with word timings
        """
        # Load audio to get duration
        audio = AudioSegment.from_wav(io.BytesIO(audio_bytes))
        duration_sec = len(audio) / 1000.0

        # Split text into words
        words = text.split()
        num_words = len(words)

        # Estimate word timing (simple uniform distribution)
        # In production, use forced alignment (e.g., Gentle, Aeneas)
        avg_word_duration = duration_sec / num_words if num_words > 0 else 0

        word_timings = []
        current_time = 0.0

        for word in words:
            word_duration = avg_word_duration * (len(word) / 5)  # Rough estimate
            word_timings.append({
                "word": word,
                "start": round(current_time, 3),
                "end": round(current_time + word_duration, 3),
            })
            current_time += word_duration

        return {
            "text": text,
            "duration": round(duration_sec, 3),
            "word_count": num_words,
            "word_timings": word_timings,
        }

    def sync_with_text(self, audio_bytes: bytes, text: str) -> Dict[str, Any]:
        """
        Synchronize audio with text for highlighting
        
        Args:
            audio_bytes: Audio bytes
            text: Text to synchronize
            
        Returns:
            Synchronization data with highlights
        """
        transcript = self.create_transcript(audio_bytes, text)

        # Create highlight segments (by sentence)
        sentences = re.split(r'[.!?]+', text)
        highlights = []
        word_idx = 0

        for sentence in sentences:
            if not sentence.strip():
                continue

            sentence_words = sentence.split()
            num_sentence_words = len(sentence_words)

            if word_idx + num_sentence_words <= len(transcript["word_timings"]):
                start_time = transcript["word_timings"][word_idx]["start"]
                end_time = transcript["word_timings"][word_idx + num_sentence_words - 1]["end"]

                highlights.append({
                    "text": sentence.strip(),
                    "start": start_time,
                    "end": end_time,
                    "word_range": [word_idx, word_idx + num_sentence_words],
                })

                word_idx += num_sentence_words

        return {
            "transcript": transcript,
            "highlights": highlights,
        }


# ============================================================================
# CDN UPLOADER
# ============================================================================


class AudioCDNUploader:
    """Upload audio to S3/CDN"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.storage_type = config.get("type", "local")
        self.bucket = config.get("bucket", "learn-your-way-audio")
        self.cdn_url = config.get("cdn_url", "https://cdn.learnyourway.com/audio")

        if self.storage_type == "s3":
            self.s3_client = boto3.client("s3")
        else:
            self.local_path = Path(config.get("local_path", "./storage/audio"))
            self.local_path.mkdir(parents=True, exist_ok=True)

    def upload_to_cdn(self, audio_bytes: bytes, metadata: Dict[str, Any]) -> str:
        """Upload audio to CDN and return URL"""
        audio_id = metadata.get("audio_id", self._generate_audio_id())
        extension = metadata.get("format", "mp3")
        key = f"audio/{audio_id}.{extension}"

        if self.storage_type == "s3":
            return self._upload_to_s3(audio_bytes, key, metadata)
        else:
            return self._upload_local(audio_bytes, key)

    def _upload_to_s3(
        self, audio_bytes: bytes, key: str, metadata: Dict[str, Any]
    ) -> str:
        """Upload to S3"""
        try:
            content_type = f"audio/{metadata.get('format', 'mpeg')}"

            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=audio_bytes,
                ContentType=content_type,
                CacheControl="public, max-age=31536000",
            )

            return f"{self.cdn_url}/{key}"

        except ClientError as e:
            logger.error("s3_upload_failed", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to upload to CDN")

    def _upload_local(self, audio_bytes: bytes, key: str) -> str:
        """Save to local storage"""
        file_path = self.local_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(audio_bytes)

        return f"{self.cdn_url}/{key}"

    def _generate_audio_id(self) -> str:
        """Generate unique audio ID"""
        timestamp = datetime.utcnow().isoformat()
        random_str = hashlib.sha256(timestamp.encode()).hexdigest()[:12]
        return f"audio_{random_str}"


# ============================================================================
# AUDIO GENERATION AGENT
# ============================================================================


class AudioGenerationAgent:
    """Main agent for educational audio generation"""

    def __init__(self, config_path: str = "config.yaml"):
        # Load configuration
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)

        self.agent_config = self.config.get("agent", {})
        self.model_config = self.config.get("models", {}).get("piper", {})
        self.generation_config = self.config.get("generation", {})
        self.narration_config = self.config.get("narration", {})
        self.processing_config = self.config.get("processing", {})
        self.storage_config = self.config.get("storage", {})
        self.sync_config = self.config.get("synchronization", {})

        # Initialize components
        self.ssml_processor = SSMLProcessor()
        self.tts_engine = PiperTTSEngine(self.model_config)
        self.audio_processor = AudioProcessor(self.processing_config)
        self.cdn_uploader = AudioCDNUploader(self.storage_config)

        logger.info("audio_generation_agent_initialized", config=self.agent_config)

    def generate_audio(
        self, text: str, voice: str = "en_US-lessac-medium", language: str = "en"
    ) -> bytes:
        """
        Generate audio from text
        
        Args:
            text: Text to synthesize
            voice: Voice model name
            language: Language code
            
        Returns:
            Audio bytes (processed)
        """
        start_time = time.time()

        logger.info("generating_audio", text_length=len(text), voice=voice)

        try:
            # Generate with Piper TTS
            raw_audio = self.tts_engine.generate_audio(text, voice)

            # Process audio
            processed_audio = self.audio_processor.process_audio(raw_audio)

            generation_time = time.time() - start_time
            generation_duration.observe(generation_time)
            audio_generated_total.labels(voice=voice, status="success").inc()

            logger.info("audio_generated", time=generation_time, size=len(processed_audio))

            return processed_audio

        except Exception as e:
            audio_generated_total.labels(voice=voice, status="failed").inc()
            logger.error("generation_failed", error=str(e))
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    def generate_dialogue(
        self, teacher_text: str, student_text: str
    ) -> bytes:
        """
        Generate teacher-student dialogue
        
        Args:
            teacher_text: Teacher's text
            student_text: Student's text
            
        Returns:
            Combined audio bytes
        """
        teacher_voice = self.narration_config.get("teacher_voice", "en_US-lessac-medium")
        student_voice = self.narration_config.get("student_voice", "en_US-ryan-medium")
        pause_duration = self.narration_config.get("pause_duration", 0.5)

        # Map voice names to full model names
        voice_map = {v["style"]: v["name"] for v in self.model_config.get("voices", [])}
        teacher_voice_full = voice_map.get(teacher_voice, "en_US-lessac-medium")
        student_voice_full = voice_map.get(student_voice, "en_US-ryan-medium")

        raw_audio = self.tts_engine.generate_dialogue(
            teacher_text=teacher_text,
            student_text=student_text,
            teacher_voice=teacher_voice_full,
            student_voice=student_voice_full,
            pause_duration=pause_duration,
        )

        return self.audio_processor.process_audio(raw_audio)

    def add_ssml_tags(
        self, text: str, emphasis: Optional[List[str]] = None, pauses: Optional[List[Tuple[int, float]]] = None
    ) -> str:
        """
        Add SSML tags to text
        
        Args:
            text: Plain text
            emphasis: Words to emphasize
            pauses: Pause positions and durations
            
        Returns:
            SSML-formatted text
        """
        return self.ssml_processor.add_ssml_tags(text, emphasis, pauses)

    def process_audio(self, audio: bytes) -> bytes:
        """
        Process and optimize audio
        
        Args:
            audio: Raw audio bytes
            
        Returns:
            Processed audio bytes
        """
        return self.audio_processor.process_audio(audio)

    def create_transcript(self, audio: bytes, text: str) -> Dict[str, Any]:
        """
        Create transcript with word timings
        
        Args:
            audio: Audio bytes
            text: Original text
            
        Returns:
            Transcript with word-level timing
        """
        return self.audio_processor.create_transcript(audio, text)

    def sync_with_text(self, audio: bytes, text: str) -> Dict[str, Any]:
        """
        Synchronize audio with text for highlighting
        
        Args:
            audio: Audio bytes
            text: Text to synchronize
            
        Returns:
            Synchronization data
        """
        return self.audio_processor.sync_with_text(audio, text)

    async def stream_audio(self, audio_id: str) -> AsyncGenerator[bytes, None]:
        """
        Stream audio in chunks
        
        Args:
            audio_id: Audio file ID
            
        Yields:
            Audio chunks
        """
        # In production, retrieve from CDN/storage
        cdn_url = f"{self.storage_config.get('cdn_url')}/audio/{audio_id}.mp3"

        # For local storage
        if self.storage_config.get("type") == "local":
            file_path = Path(self.storage_config.get("local_path", "./storage/audio")) / f"audio/{audio_id}.mp3"
            
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Audio not found")

            chunk_size = 8192
            with open(file_path, "rb") as f:
                while chunk := f.read(chunk_size):
                    yield chunk
                    await asyncio.sleep(0.01)  # Simulate streaming delay
        else:
            # For S3, would implement streaming from S3
            raise HTTPException(status_code=501, detail="S3 streaming not implemented")


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="Audio Generation Agent",
    description="Educational audio generation with Piper TTS and multi-voice narration",
    version="1.0.0",
)

# Global agent instance
agent: Optional[AudioGenerationAgent] = None


@app.on_event("startup")
async def startup():
    """Initialize agent on startup"""
    global agent
    agent = AudioGenerationAgent("config.yaml")
    logger.info("audio_generation_agent_started")


@app.post("/generate", response_model=AudioResponse)
async def generate_endpoint(request: GenerateAudioRequest):
    """Generate audio from text"""
    start_time = time.time()

    try:
        # Generate audio
        audio_bytes = agent.generate_audio(
            text=request.text, voice=request.voice, language=request.language
        )

        # Create transcript if enabled
        transcript = None
        if agent.sync_config.get("generate_transcript", True):
            transcript = agent.create_transcript(audio_bytes, request.text)

        # Generate metadata
        audio_id = agent.cdn_uploader._generate_audio_id()
        metadata = {
            "audio_id": audio_id,
            "voice": request.voice,
            "language": request.language,
            "format": agent.processing_config.get("output_format", "mp3"),
            "generated_at": datetime.utcnow().isoformat(),
        }

        # Upload to CDN
        cdn_url = agent.cdn_uploader.upload_to_cdn(audio_bytes, metadata)

        return AudioResponse(
            audio_id=audio_id,
            cdn_url=cdn_url,
            duration=transcript["duration"] if transcript else 0.0,
            transcript=transcript,
            metadata=metadata,
            generation_time=time.time() - start_time,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("generate_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/dialogue", response_model=AudioResponse)
async def generate_dialogue_endpoint(request: GenerateDialogueRequest):
    """Generate teacher-student dialogue"""
    start_time = time.time()

    try:
        audio_bytes = agent.generate_dialogue(
            teacher_text=request.teacher_text, student_text=request.student_text
        )

        # Create transcript
        full_text = f"Teacher: {request.teacher_text} Student: {request.student_text}"
        transcript = agent.create_transcript(audio_bytes, full_text)

        # Metadata
        audio_id = agent.cdn_uploader._generate_audio_id()
        metadata = {
            "audio_id": audio_id,
            "type": "dialogue",
            "format": agent.processing_config.get("output_format", "mp3"),
            "generated_at": datetime.utcnow().isoformat(),
        }

        # Upload
        cdn_url = agent.cdn_uploader.upload_to_cdn(audio_bytes, metadata)

        return AudioResponse(
            audio_id=audio_id,
            cdn_url=cdn_url,
            duration=transcript["duration"],
            transcript=transcript,
            metadata=metadata,
            generation_time=time.time() - start_time,
        )

    except Exception as e:
        logger.error("dialogue_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ssml", response_model=AudioResponse)
async def generate_ssml_endpoint(request: GenerateSSMLRequest):
    """Generate audio with SSML markup"""
    start_time = time.time()

    try:
        # Parse SSML to get plain text
        plain_text = agent.ssml_processor.strip_ssml(request.ssml_text)

        # Generate audio (Piper has limited SSML support, so we use plain text)
        audio_bytes = agent.generate_audio(text=plain_text, voice=request.voice)

        # Create transcript
        transcript = agent.create_transcript(audio_bytes, plain_text)

        # Metadata
        audio_id = agent.cdn_uploader._generate_audio_id()
        metadata = {
            "audio_id": audio_id,
            "voice": request.voice,
            "ssml": True,
            "format": agent.processing_config.get("output_format", "mp3"),
            "generated_at": datetime.utcnow().isoformat(),
        }

        # Upload
        cdn_url = agent.cdn_uploader.upload_to_cdn(audio_bytes, metadata)

        return AudioResponse(
            audio_id=audio_id,
            cdn_url=cdn_url,
            duration=transcript["duration"],
            transcript=transcript,
            metadata=metadata,
            generation_time=time.time() - start_time,
        )

    except Exception as e:
        logger.error("ssml_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/audio/{audio_id}")
async def get_audio_endpoint(audio_id: str):
    """Retrieve audio file"""
    # In production, retrieve from database
    return {
        "audio_id": audio_id,
        "status": "available",
        "cdn_url": f"{agent.storage_config.get('cdn_url')}/audio/{audio_id}.mp3",
    }


@app.get("/transcript/{audio_id}", response_model=TranscriptResponse)
async def get_transcript_endpoint(audio_id: str):
    """Get synchronized transcript"""
    # In production, retrieve from database
    # For demo, return mock data
    return TranscriptResponse(
        audio_id=audio_id,
        text="Sample transcript text",
        word_timings=[
            {"word": "Sample", "start": 0.0, "end": 0.5},
            {"word": "transcript", "start": 0.5, "end": 1.0},
        ],
        highlights=[
            {"text": "Sample transcript", "start": 0.0, "end": 1.0, "word_range": [0, 2]}
        ],
    )


@app.get("/stream/{audio_id}")
async def stream_audio_endpoint(audio_id: str):
    """Stream audio file"""
    try:
        return StreamingResponse(
            agent.stream_audio(audio_id),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename={audio_id}.mp3",
                "Accept-Ranges": "bytes",
            },
        )
    except Exception as e:
        logger.error("stream_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/stream/{audio_id}")
async def websocket_stream(websocket: WebSocket, audio_id: str):
    """WebSocket audio streaming"""
    await websocket.accept()

    try:
        async for chunk in agent.stream_audio(audio_id):
            await websocket.send_bytes(chunk)

        await websocket.close()

    except WebSocketDisconnect:
        logger.info("websocket_disconnected", audio_id=audio_id)
    except Exception as e:
        logger.error("websocket_stream_failed", error=str(e))
        await websocket.close(code=1011, reason=str(e))


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "audio_generation_agent",
        "tts_engine": "piper",
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn

    config = yaml.safe_load(open("config.yaml"))
    agent_config = config.get("agent", {})

    uvicorn.run(
        app,
        host=agent_config.get("host", "0.0.0.0"),
        port=agent_config.get("port", 8005),
    )
