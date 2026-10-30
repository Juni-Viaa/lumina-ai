from rest_framework import serializers, pagination

from core.models import Document, Chunk, IngestLog


class DocumentPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = "limit"
    max_page_size = 100


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer untuk model Document."""

    size_human = serializers.SerializerMethodField()
    user_username = serializers.CharField(source="user.username", read_only=True)
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "user",
            "user_username",
            "document_name",
            "path_file",
            "file_type",
            "size",
            "size_human",
            "status",
            "ingest_session_id",
            "created_at",
            "updated_at",
            "deleted_at",
            "chunk_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]

    def get_size_human(self, obj: Document) -> str:
        """Mengembalikan ukuran file dalam format human-readable."""
        bytes_size = obj.size
        if bytes_size < 1024:
            return f"{bytes_size} B"
        if bytes_size < 1048576:
            return f"{round(bytes_size / 1024, 1)} KB"
        return f"{round(bytes_size / 1048576, 1)} MB"

    def get_chunk_count(self, obj: Document) -> int:
        """Mengembalikan jumlah chunk untuk dokumen ini."""
        return obj.chunks.filter(deleted_at__isnull=True).count()


class ChunkSerializer(serializers.ModelSerializer):
    """Serializer untuk model Chunk."""

    class Meta:
        model = Chunk
        fields = [
            "id",
            "document",
            "chunk_text",
            "page",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]


class IngestLogSerializer(serializers.ModelSerializer):
    """Serializer untuk model IngestLog."""

    class Meta:
        model = IngestLog
        fields = [
            "id",
            "document",
            "session_id",
            "step",
            "status",
            "message",
            "error_message",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]