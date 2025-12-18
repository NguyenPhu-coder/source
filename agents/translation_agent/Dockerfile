# Translation Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY translation_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY translation_agent/translation_agent.py .
COPY translation_agent/config.yaml .

# Create model cache directory
RUN mkdir -p /app/models

# Expose port
EXPOSE 8022

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8022/health')"

# Run application
CMD ["python", "translation_agent.py"]
