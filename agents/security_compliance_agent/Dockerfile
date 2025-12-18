# Security Compliance Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY security_compliance_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY security_compliance_agent/security_compliance_agent.py .
COPY security_compliance_agent/config.yaml .

# Create directories
RUN mkdir -p /app/logs /app/keys

# Expose port
EXPOSE 8017

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8017/health')"

# Run application
CMD ["python", "security_compliance_agent.py"]
