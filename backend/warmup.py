"""
warmup.py — Preload AI models at container startup.
Run this before Django runserver / celery worker starts accepting requests.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def warmup_models():
    """Load embedding model into memory at startup."""
    # Ensure cache dir exists
    cache_dir = os.getenv("EMBEDDING_MODEL_CACHE_DIR", "/app/models")
    os.makedirs(cache_dir, exist_ok=True)

    # Setup Django settings
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lumina.settings.development")
    import django
    django.setup()

    # Load embedding model (singleton from services.py)
    from ingest.services import get_embeddings
    logger.info("Warming up embedding model: %s", os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-large"))
    embeddings = get_embeddings()

    # Test encode to ensure model is fully loaded (not just initialized)
    _ = embeddings.embed_query("query: warmup test")
    logger.info("Embedding model warmed up successfully")


if __name__ == "__main__":
    try:
        warmup_models()
    except Exception as e:
        logger.exception("Warmup failed")
        sys.exit(1)