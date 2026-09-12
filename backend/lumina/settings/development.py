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

ALLOWED_HOSTS = [host for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if host or host == "testserver"]

# ── CORS ────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    origin
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin
]

CORS_ALLOW_CREDENTIALS = True

# ── Email ───────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]