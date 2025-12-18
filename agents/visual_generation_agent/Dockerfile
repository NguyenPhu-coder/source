# Visual Generation Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY visual_generation_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY visual_generation_agent/visual_generation_agent.py .
COPY visual_generation_agent/config.yaml .

# Create directories
RUN mkdir -p /app/images /app/models

# Expose port
EXPOSE 8020

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8020/health')"

# Run application
CMD ["python", "visual_generation_agent.py"]
