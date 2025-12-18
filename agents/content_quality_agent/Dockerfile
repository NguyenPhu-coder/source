# Content Quality Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY content_quality_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY content_quality_agent/content_quality_agent.py .
COPY content_quality_agent/config.yaml .

# Create model cache directory
RUN mkdir -p /app/models

# Expose port
EXPOSE 8031

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8031/health')"

# Run application
CMD ["python", "content_quality_agent.py"]
