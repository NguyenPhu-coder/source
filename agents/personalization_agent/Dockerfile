# Personalization Agent Dockerfile
FROM python:3.10-slim as base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ==================== BUILD STAGE ====================
FROM base as builder

# Copy and install requirements from agent directory
COPY personalization_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==================== PRODUCTION STAGE ====================
FROM base as production

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application from agent directory
COPY personalization_agent/personalization_agent.py .
COPY personalization_agent/config.yaml .

# Create directories
RUN mkdir -p models logs

# Expose port
EXPOSE 8009

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8009/health || exit 1

# Run application
CMD ["python", "personalization_agent.py"]
