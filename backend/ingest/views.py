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
from core.models import IngestLog, Document as DocumentModel

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_SIZE_KB = 102400  # 100 MB


class IngestStatusView(APIView):
    """
    GET /api/ingest/status/{document_id}/
    Polling endpoint untuk status dan log ingest.
    Query params:
    - session: session_id untuk menyekat log sesi
    - after: last_log_id untuk ambil log baru saja
    """

    authentication_classes = [*APIView.authentication_classes]
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id: int, *args, **kwargs):
        if not (request.user.is_authenticated and request.user.role == "admin"):
            return Response(
                {"detail": "Anda tidak memiliki izin untuk melihat status ingest."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            document = DocumentModel.objects.get(pk=document_id)
        except DocumentModel.DoesNotExist:
            return Response(
                {"detail": "Dokumen tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        session_id = request.query_params.get("session")
        after_id = int(request.query_params.get("after", 0))

        # Fetch new logs
        log_query = IngestLog.objects.filter(document_id=document_id, id__gt=after_id).order_by("id")
        if session_id:
            log_query = log_query.filter(session_id=session_id)

        logs = [
            {
                "id": log.id,
                "step": log.step,
                "message": log.message,
                "created_at": log.created_at.isoformat(),
            }
            for log in log_query
        ]

        return Response(
            {
                "logs": logs,
                "status": document.status,
            }
        )


class IngestUploadView(APIView):
    """
    POST /api/ingest/upload/
    Accepts a multipart file upload, creates a Document record, and returns immediately.
    The actual ingest pipeline runs asynchronously (to be implemented).
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

        # Create Document record with status=processing
        if document_id is None:
            document = DocumentModel.objects.create(
                user_id=request.user.id,
                document_name=file.name,
                path_file=str(dest_path),
                file_type=suffix.lstrip(".").lower(),
                size=file.size,
                status=DocumentModel.Status.PROCESSING,
                ingest_session_id=session_id,
            )
        else:
            DocumentModel.objects.filter(pk=document_id).update(
                status=DocumentModel.Status.PROCESSING,
                ingest_session_id=session_id,
            )
            document = DocumentModel.objects.get(pk=document_id)

        return Response(
            {
                "message": "Dokumen berhasil diupload dan sedang diproses.",
                "document_id": document.id,
                "session_id": session_id,
                "status": "processing",
            },
            status=status.HTTP_201_CREATED,
        )
