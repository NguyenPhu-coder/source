# Audio Generation Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install FFmpeg and audio dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY audio_generation_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY audio_generation_agent/audio_generation_agent.py .
COPY audio_generation_agent/config.yaml .

# Create directories for audio files
RUN mkdir -p /app/audio /app/models

# Expose port
EXPOSE 8021

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8021/health')"

# Run application
CMD ["python", "audio_generation_agent.py"]
