# ── Backend Dockerfile (Django) ──────────────────────────────────────────────
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# OpenCV/PaddleOCR need OpenGL and GLib even for image-only processing.
# Include the Qt platform dependencies shipped with opencv-contrib-python.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libice6 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose Django development server port
EXPOSE 8000

# Production: gunicorn; Development: runserver
CMD ["sh", "-c", "python manage.py migrate && gunicorn lumina.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]
