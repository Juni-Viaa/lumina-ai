# ── Backend Dockerfile (Django) ──────────────────────────────────────────────
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=0 \
    HF_HOME=/app/models/huggingface \
    TRANSFORMERS_CACHE=/app/models/huggingface/hub \
    SENTENCE_TRANSFORMERS_HOME=/app/models/sentence_transformers \
    TORCH_HOME=/app/models/torch \
    EMBEDDING_MODEL_CACHE_DIR=/app/models

# Install system dependencies (psycopg2, build tools, libmagic for MIME detection)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies with pip caching enabled (CPU-only PyTorch to save ~5GB)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

# Copy the rest of the application
COPY . .

# Copy warmup script
COPY warmup.py .

# Expose Django development server port
EXPOSE 8000

# Entrypoint: warmup models, then run migrations and start server
ENTRYPOINT ["python", "warmup.py"]
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
