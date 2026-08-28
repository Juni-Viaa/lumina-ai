"""
views.py — API views for the ingest pipeline.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import run_ingest_pipeline

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_SIZE_KB = 102400  # 100 MB


class IngestUploadView(APIView):
    """
    POST /api/ingest/upload/
    Accepts a multipart file upload, creates a Document record, and runs the
    ingest pipeline (load → preprocess → chunk → embed → persist to pgvector).
    Optionally accepts `document_id` to re-ingest an existing document.
    """

    authentication_classes = [*APIView.authentication_classes]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        if not (request.user.is_authenticated and request.user.role == "admin"):
            return Response(
                {"detail": "Anda tidak memiliki izin untuk mengunggah dokumen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        file: UploadedFile | None = request.FILES.get("document")
        if file is None:
            return Response(
                {"detail": "Field 'document' (file) is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate extension
        suffix = Path(file.name).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            return Response(
                {"detail": f"Tipe file tidak didukung: {suffix}"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Validate size
        if file.size and file.size > MAX_SIZE_KB * 1024:
            return Response(
                {"detail": "Ukuran file melebihi batas 100 MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        # Optional document_id for re-ingest
        document_id = request.data.get("document_id")
        if document_id is not None:
            try:
                document_id = int(document_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "document_id harus berupa integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Save uploaded file to a temp location with UUID filename
        upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_filename = f"{uuid.uuid4()}{suffix}"
        dest_path = upload_dir / safe_filename
        with open(dest_path, "wb+") as dest:
            for chunk in file.chunks():
                dest.write(chunk)

        session_id = str(uuid.uuid4())

        try:
            result = run_ingest_pipeline(
                file_path=dest_path,
                original_filename=file.name,
                document_id=document_id,
                user_id=request.user.id if request.user.is_authenticated else None,
                session_id=session_id,
            )
            return Response(
                {
                    "message": "Dokumen berhasil diupload dan sedang diproses.",
                    "document_id": result["document_id"],
                    "session_id": session_id,
                    "status": "indexed",
                    "chunks_added": result["chunks_added"],
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Ingest upload failed")
            return Response(
                {"detail": f"Gagal memproses dokumen: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )