"""
apps.py — Django app config for the ingest app.
"""

from django.apps import AppConfig


class IngestConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ingest"
    verbose_name = "Ingest"

    def ready(self) -> None:
        """Pre‑load the embedding model when Django starts.
        This guarantees the model is cached (downloaded once) and avoids the
        latency on the first upload request.
        """
        from .services import get_embeddings
        try:
            get_embeddings()
        except Exception as exc:  # pragma: no‑cover
            # Log but don't crash the app – the ingest view will still handle errors.
            import logging
            logging.getLogger(__name__).exception("Failed to preload embedding model: %s", exc)
