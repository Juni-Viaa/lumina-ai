from rest_framework import serializers
from django.core.files.uploadedfile import UploadedFile

from core.models import Document, Chunk, IngestLog


class DocumentUploadSerializer(serializers.Serializer):
    document = serializers.FileField(error_messages={"required": "Pilih dokumen terlebih dahulu.", "empty": "File kosong tidak dapat diunggah."})

    def validate_document(self, value: UploadedFile) -> UploadedFile:
        from pathlib import Path
        if Path(value.name).suffix.lower() not in {".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}:
            raise serializers.ValidationError("Tipe file tidak didukung.")
        if value.size > 100 * 1024 * 1024:
            raise serializers.ValidationError("Ukuran file melebihi batas 100 MB.")
        return value


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer untuk model Document."""

    size_human = serializers.SerializerMethodField()
    user_username = serializers.CharField(source="user.username", read_only=True)

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
            "is_ocr",
            "ingest_session_id",
            "created_at",
            "updated_at",
            "deleted_at",
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


class ChunkSerializer(serializers.ModelSerializer):
    """Serializer untuk model Chunk."""

    class Meta:
        model = Chunk
        fields = [
            "id",
            "document",
            "chunk_text",
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
            "message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
