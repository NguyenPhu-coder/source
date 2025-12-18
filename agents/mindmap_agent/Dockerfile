# Mind Map Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install Cairo for SVG/PNG rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf-2.0-dev \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory
COPY mindmap_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application from agent directory
COPY mindmap_agent/mindmap_agent.py .
COPY mindmap_agent/config.yaml .

# Create output directory
RUN mkdir -p /app/output

# Expose port
EXPOSE 8023

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8023/health')"

# Run application
CMD ["python", "mindmap_agent.py"]
