# Local AI Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY local_ai_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY local_ai_agent/local_ai_agent.py .
COPY local_ai_agent/config.yaml .

# Create model cache directory
RUN mkdir -p /app/models /app/cache

# Expose port
EXPOSE 8014

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8014/health')"

# Run application
CMD ["python", "local_ai_agent.py"]
