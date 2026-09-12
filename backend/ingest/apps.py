"""
apps.py — Django app config for the ingest app.
"""

from django.apps import AppConfig


class IngestConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ingest"
    verbose_name = "Ingest"

    def ready(self) -> None:
        """Pre‑load the embedding model when Django starts."""
        import logging
        try:
            from .services import get_embeddings
            get_embeddings()
        except ImportError:
            logging.getLogger(__name__).info("Embedding deps not yet available, skipping preload.")
        except Exception as exc:  # pragma: no‑cover
            logging.getLogger(__name__).exception("Failed to preload embedding model: %s", exc)
