from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import Document, Chunk, IngestLog
from .serializers import DocumentSerializer, ChunkSerializer, IngestLogSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD dokumen."""

    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter dokumen berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return Document.objects.filter(deleted_at__isnull=True)
        return Document.objects.filter(user=user, deleted_at__isnull=True)

    def perform_create(self, serializer):
        """Set user_id otomatis dari user yang sedang login."""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def chunks(self, request, pk=None):
        """Mengembalikan daftar chunk untuk dokumen tertentu."""
        document = self.get_object()
        chunks = Chunk.objects.filter(document=document, deleted_at__isnull=True)
        serializer = ChunkSerializer(chunks, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def ingest_logs(self, request, pk=None):
        """Mengembalikan log ingest untuk dokumen tertentu."""
        document = self.get_object()
        logs = IngestLog.objects.filter(document=document).order_by("-created_at")
        serializer = IngestLogSerializer(logs, many=True)
        return Response(serializer.data)


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
