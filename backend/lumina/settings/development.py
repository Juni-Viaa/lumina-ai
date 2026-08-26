"""
Development settings untuk proyek Lumina.

Digunakan saat DJANGO_ENV=development (default).
"""
import os

from lumina.settings.base import *  # noqa: F401,F403

# ── Security ────────────────────────────────────────────────────────────────
DEBUG = True

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-w@)$18!m6_vhuaxt8wnkua_ec_&&@el^qnza^qi8&hzx6s4w&9",
)

ALLOWED_HOSTS = ["*"]

# ── Database ────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "lumina"),
        "USER": os.environ.get("DB_USER", "lumina"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "lumina_secret"),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "5433"),
    }
}

# ── CORS ────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOW_CREDENTIALS = True

# ── Email ───────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]