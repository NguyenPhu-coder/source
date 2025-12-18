# Database Management Agent Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install PostgreSQL client and development libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements from agent directory (minimal deps)
COPY requirements-base.txt .
COPY database_management_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --timeout=300

# Copy application from agent directory
COPY database_management_agent/database_management_agent.py .
COPY database_management_agent/config.yaml .

# Create migrations directory
RUN mkdir -p /app/migrations

# Expose port
EXPOSE 8016

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8016/health')"

# Run application
CMD ["python", "database_management_agent.py"]
