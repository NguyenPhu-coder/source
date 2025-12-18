# Infrastructure Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install Docker CLI for container management
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    gnupg \
    lsb-release \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY infrastructure_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY infrastructure_agent/infrastructure_agent.py .
COPY infrastructure_agent/config.yaml .

# Create directories
RUN mkdir -p /app/backups /app/logs

# Expose port
EXPOSE 8019

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8019/health')"

# Run application
CMD ["python", "infrastructure_agent.py"]
