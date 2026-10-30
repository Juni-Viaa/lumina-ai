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
        """Filter dokumen berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return Document.objects.filter(deleted_at__isnull=True)
        return Document.objects.filter(user=user, deleted_at__isnull=True)

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
            document = Document.objects.get(pk=pk)
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
            document = Document.objects.get(pk=pk)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Dokumen tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )
        logs = IngestLog.objects.filter(document=document).order_by("-created_at")
        serializer = IngestLogSerializer(logs, many=True)
        return Response({"results": serializer.data})

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
