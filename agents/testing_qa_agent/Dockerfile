# Testing QA Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for testing tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY testing_qa_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY testing_qa_agent/testing_qa_agent.py .
COPY testing_qa_agent/config.yaml .

# Create directories
RUN mkdir -p /app/reports /app/test-results

# Expose port
EXPOSE 8032

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8032/health')"

# Run application
CMD ["python", "testing_qa_agent.py"]
