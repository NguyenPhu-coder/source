# Assessment Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY assessment_agent/requirements.txt .
COPY requirements-base.txt .

# Install PyTorch CPU-only first (smaller, faster download)
# Then install other requirements with increased timeout
RUN pip install --no-cache-dir --default-timeout=300 \
    torch==2.1.1+cpu torchvision==0.16.1+cpu torchaudio==2.1.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --default-timeout=300 -r requirements.txt

# Copy application from agent directory
COPY assessment_agent/assessment_agent.py .
COPY assessment_agent/config.yaml .

# Create model cache directory
RUN mkdir -p /app/models

# Expose port
EXPOSE 8008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8008/health')"

# Run application
CMD ["python", "assessment_agent.py"]
