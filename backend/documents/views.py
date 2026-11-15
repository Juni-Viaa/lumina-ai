from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db.models import Count, Q

from core.models import Document, Chunk, IngestLog
from .serializers import DocumentSerializer, ChunkSerializer, IngestLogSerializer, DocumentPagination


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD dokumen."""

    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DocumentPagination

    def get_queryset(self):
        """Filter dokumen berdasarkan user yang sedang login dan query parameters."""
        user = self.request.user
        if user.role == "admin":
            qs = Document.objects.filter(deleted_at__isnull=True)
        else:
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
