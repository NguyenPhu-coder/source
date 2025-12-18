# Realtime Coordination Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY realtime_coordination_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY realtime_coordination_agent/realtime_coordination_agent.py .
COPY realtime_coordination_agent/config.yaml .

# Expose port (HTTP + WebSocket)
EXPOSE 8018

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8018/health')"

# Run application
CMD ["python", "realtime_coordination_agent.py"]
