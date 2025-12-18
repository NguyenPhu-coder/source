# Content Ingestion Agent Dockerfile
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy and install requirements from agent directory
COPY content_ingestion_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY content_ingestion_agent/content_ingestion_agent.py .
COPY content_ingestion_agent/config.yaml .

# Create directories
RUN mkdir -p /tmp/ingestion /data/processed /data/uploads

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8001/health')"

# Run application
CMD ["uvicorn", "content_ingestion_agent:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
