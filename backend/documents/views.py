import json
import time

from django.db.models import Count, Q
from django.http import StreamingHttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Document, Chunk, IngestLog
from core.renderers import ServerSentEventRenderer
from .serializers import DocumentSerializer, ChunkSerializer, IngestLogSerializer, DocumentPagination


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD dokumen."""

    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DocumentPagination

    def get_queryset(self):
        """Filter dokumen berdasarkan user yang sedang login dan query parameters.

        Admin tidak dapat melihat dokumen milik user lain — setiap user
        (termasuk admin) hanya melihat dokumen milik dirinya sendiri.
        """
        user = self.request.user
        qs = Document.objects.filter(user=user, deleted_at__isnull=True)

        status_param = self.request.query_params.get("status")
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)

        file_type = self.request.query_params.get("file_type")
        if file_type and file_type != "all":
            qs = qs.filter(file_type__iexact=file_type)

        doc_name = self.request.query_params.get("document_name")
        if doc_name:
            qs = qs.filter(document_name__icontains=doc_name)

        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Mengembalikan ringkasan statistik dokumen (admin only)."""
        if not (request.user.is_authenticated and request.user.role == "admin"):
            return Response(
                {"detail": "Anda tidak memiliki izin untuk melihat ringkasan dokumen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        total_count = Document.objects.filter(deleted_at__isnull=True).count()
        indexed_count = Document.objects.filter(
            deleted_at__isnull=True,
            status__in=["indexed", "completed", "success"],
        ).count()
        processing_count = Document.objects.filter(
            deleted_at__isnull=True,
            status__in=["processing", "pending"],
        ).count()
        failed_count = Document.objects.filter(
            deleted_at__isnull=True,
            status__in=["failed", "error"],
        ).count()

        return Response(
            {
                "total": total_count,
                "indexed": indexed_count,
                "processing": processing_count,
                "failed": failed_count,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def chunks(self, request, pk=None):
        """Mengembalikan daftar chunk untuk dokumen tertentu."""
        try:
            document = self.get_queryset().get(pk=pk)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Dokumen tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )
        chunks = Chunk.objects.filter(document=document, deleted_at__isnull=True)
        serializer = ChunkSerializer(chunks, many=True)
        return Response({"results": serializer.data})

    @action(detail=True, methods=["get"])
    def ingest_logs(self, request, pk=None):
        """Mengembalikan log ingest untuk dokumen tertentu."""
        try:
            document = self.get_queryset().get(pk=pk)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Dokumen tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )
        logs = IngestLog.objects.filter(document=document).order_by("-created_at")
        serializer = IngestLogSerializer(logs, many=True)
        return Response({"results": serializer.data})

    @action(detail=True, methods=["get"])
    def visual(self, request, pk=None):
        """Mengembalikan hasil OCR dan Vision yang dikelompokkan berdasarkan image_ref."""
        try:
            document = self.get_queryset().get(pk=pk)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Dokumen tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        chunks = Chunk.objects.filter(
            document=document,
            deleted_at__isnull=True,
        ).order_by("page", "id")

        # ponytail: in-memory group by image_ref suffices for typical docs (<1k chunks); add DB-level JSON aggregation when chunk counts exceed thousands per doc.
        groups: dict[str, dict] = {}
        for chunk in chunks:
            meta = chunk.metadata or {}
            source_type = meta.get("source_type")
            if source_type not in ("ocr", "vision"):
                continue
            key = meta.get("image_ref") or f"chunk-{chunk.id}"
            if key not in groups:
                groups[key] = {"imageRef": key, "ocr": [], "vision": []}
            item = {"chunk_text": chunk.chunk_text, "metadata": meta}
            if source_type == "ocr":
                groups[key]["ocr"].append(item)
            else:
                groups[key]["vision"].append(item)

        return Response(list(groups.values()))

    def perform_create(self, serializer):
        """Set user_id otomatis dari user yang sedang login."""
        serializer.save(user=self.request.user)


class ChunkViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk chunk dokumen."""

    queryset = Chunk.objects.all()
    serializer_class = ChunkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter chunk berdasarkan dokumen milik user."""
        user = self.request.user
        if user.role == "admin":
            return Chunk.objects.filter(deleted_at__isnull=True, document__deleted_at__isnull=True)
        return Chunk.objects.filter(document__user=user, deleted_at__isnull=True, document__deleted_at__isnull=True)


class IngestLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk log ingest."""

    queryset = IngestLog.objects.all()
    serializer_class = IngestLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter log berdasarkan dokumen milik user."""
        user = self.request.user
        if user.role == "admin":
            return IngestLog.objects.filter(document__deleted_at__isnull=True)
        return IngestLog.objects.filter(document__user=user, document__deleted_at__isnull=True)


class DocumentStreamView(APIView):
    """
    GET /api/documents/stream/
    Server-Sent Events (SSE) endpoint untuk pembaruan real-time status dokumen
    dan statistik dokumen tanpa perlu polling periodik (setInterval) di frontend.
    """

    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [ServerSentEventRenderer, JSONRenderer]

    def get(self, request, *args, **kwargs):
        user = request.user

        def event_stream():
            last_stats = None
            last_statuses: dict[int, str] = {}

            # Stream for up to ~45 seconds (30 iterations * 1.5s sleep), EventSource will auto-reconnect
            for _ in range(30):
                # Admin juga hanya dapat melihat dokumen milik dirinya sendiri.
                qs = Document.objects.filter(user=user, deleted_at__isnull=True)

                total = qs.count()
                indexed = qs.filter(status__in=["indexed", "completed", "success"]).count()
                processing = qs.filter(status__in=["processing", "pending"]).count()
                failed = qs.filter(status__in=["failed", "error"]).count()

                current_stats = {
                    "total": total,
                    "indexed": indexed,
                    "processing": processing,
                    "failed": failed,
                }

                if current_stats != last_stats:
                    yield f"data: {json.dumps({'type': 'stats', 'data': current_stats})}\n\n"
                    last_stats = current_stats

                # Check active documents
                active_docs = list(
                    qs.filter(status__in=["processing", "pending"])
                    .values("id", "document_name", "status", "size", "file_type", "is_ocr")
                )
                for doc in active_docs:
                    doc_id = doc["id"]
                    if last_statuses.get(doc_id) != doc["status"]:
                        yield f"data: {json.dumps({'type': 'doc_status', 'data': doc})}\n\n"
                        last_statuses[doc_id] = doc["status"]

                # Notify transition for completed/failed documents
                for doc_id in list(last_statuses.keys()):
                    if not any(d["id"] == doc_id for d in active_docs):
                        try:
                            finished_doc = qs.get(id=doc_id)
                            yield f"data: {json.dumps({'type': 'doc_status', 'data': {'id': doc_id, 'document_name': finished_doc.document_name, 'status': finished_doc.status, 'size': finished_doc.size, 'file_type': finished_doc.file_type, 'is_ocr': finished_doc.is_ocr}})}\n\n"
                        except Document.DoesNotExist:
                            pass
                        del last_statuses[doc_id]

                # SSE heartbeat comment to prevent connection timeout
                yield ": keep-alive\n\n"
                time.sleep(1.5)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
