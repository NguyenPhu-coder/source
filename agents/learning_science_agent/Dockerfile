# Learning Science Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY learning_science_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY learning_science_agent/learning_science_agent.py .
COPY learning_science_agent/config.yaml .

# Create database directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8030/health')"

# Run application
CMD ["python", "learning_science_agent.py"]
