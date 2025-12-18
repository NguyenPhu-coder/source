# Caching Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Copy and install requirements from agent directory
COPY caching_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY caching_agent/caching_agent.py .
COPY caching_agent/config.yaml .

# Expose port
EXPOSE 8015

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8015/health')"

# Run application
CMD ["python", "caching_agent.py"]
