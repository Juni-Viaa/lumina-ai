import os
import time
import uuid
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from core.models import Document
from ingest import config
from ingest.services import run_ingest_pipeline


class Command(BaseCommand):
    help = "Re-ingest documents into pgvector"

    def add_arguments(self, parser):
        parser.add_argument(
            "--doc-id",
            type=int,
            help="Ingest a specific document ID only",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of documents to process in this run",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force re-ingest even if document already has all chunks embedded",
        )
        parser.add_argument(
            "--uploads-dir",
            type=str,
            default=str(Path(settings.MEDIA_ROOT) / "uploads"),
            help="Directory containing source document files",
        )

    def handle(self, *args, **options):
        doc_id = options.get("doc_id")
        limit = options.get("limit")
        force = options.get("force", False)
        uploads_dir = Path(options["uploads_dir"])

        if doc_id:
            documents = Document.objects.filter(id=doc_id, deleted_at__isnull=True)
        else:
            documents = Document.objects.filter(deleted_at__isnull=True).order_by("id")

        total = documents.count()
        self.stdout.write(self.style.NOTICE(f"Found {total} document(s) in database."))

        success_count = 0
        fail_count = 0
        processed_count = 0

        for idx, doc in enumerate(documents, start=1):
            chunk_count = doc.chunks.count()
            unembedded_count = doc.chunks.filter(embedding__isnull=True).count()
            if not force and chunk_count > 0 and unembedded_count == 0:
                self.stdout.write(f"\n[{idx}/{total}] Skipping ID={doc.id}: '{doc.document_name}' (already has {chunk_count} embedded chunks)")
                success_count += 1
                continue

            if limit is not None and processed_count >= limit:
                self.stdout.write(self.style.NOTICE(f"Reached limit of {limit} document(s). Stopping."))
                break

            self.stdout.write(f"\n[{idx}/{total}] Processing ID={doc.id}: '{doc.document_name}'...")
            processed_count += 1

            source_file = uploads_dir / doc.document_name
            if not source_file.exists():
                # Fallback to existing path_file if present
                candidate = Path(doc.path_file)
                if candidate.exists():
                    source_file = candidate
                else:
                    self.stdout.write(self.style.ERROR(f"  Source file not found at {source_file} or {doc.path_file}"))
                    fail_count += 1
                    continue

            session_id = str(uuid.uuid4())
            start_time = time.time()
            try:
                res = run_ingest_pipeline(
                    file_path=source_file,
                    original_filename=doc.document_name,
                    document_id=doc.id,
                    user_id=doc.user_id,
                    session_id=session_id,
                )
                elapsed = time.time() - start_time
                chunks_added = res.get("chunks_added", 0)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Done in {elapsed:.2f}s - {chunks_added} chunks saved (Path: {res.get('file_path')})"
                    )
                )
                success_count += 1
            except Exception as exc:
                elapsed = time.time() - start_time
                self.stdout.write(self.style.ERROR(f"  Failed after {elapsed:.2f}s: {exc}"))
                fail_count += 1

        self.stdout.write(
            self.style.NOTICE(f"\nFinished: {success_count} succeeded, {fail_count} failed out of {total} documents.")
        )
