# Knowledge Graph Agent Dockerfile
FROM python:3.10-slim as builder

WORKDIR /app

# Copy and install requirements from agent directory
COPY knowledge_graph_agent/requirements.txt .
COPY requirements-base.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.10-slim

WORKDIR /app

# Copy installed packages
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application from agent directory
COPY knowledge_graph_agent/knowledge_graph_agent.py .
COPY knowledge_graph_agent/config.yaml .

# Expose port
EXPOSE 8010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8010/health')"

# Run application
CMD ["python", "knowledge_graph_agent.py"]
