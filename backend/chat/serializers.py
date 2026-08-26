from rest_framework import serializers

from core.models import Query, Answer, History


class QuerySerializer(serializers.ModelSerializer):
    """Serializer untuk model Query."""

    display_title = serializers.SerializerMethodField()
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Query
        fields = [
            "id",
            "user",
            "user_username",
            "query_text",
            "query_title",
            "display_title",
            "status",
            "current_step",
            "response_time_ms",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]

    def get_display_title(self, obj: Query) -> str:
        """Mengembalikan judul query, fallback ke potongan query_text."""
        if obj.query_title:
            return obj.query_title
        text = obj.query_text[:60]
        return f"{text}..." if len(obj.query_text) > 60 else text


class AnswerSerializer(serializers.ModelSerializer):
    """Serializer untuk model Answer."""

    class Meta:
        model = Answer
        fields = [
            "id",
            "query",
            "answer_text",
            "sources",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]


class HistorySerializer(serializers.ModelSerializer):
    """Serializer untuk model History."""

    query_detail = QuerySerializer(source="query", read_only=True)
    answer_detail = AnswerSerializer(source="answer", read_only=True)

    class Meta:
        model = History
        fields = [
            "id",
            "user",
            "query",
            "query_detail",
            "answer",
            "answer_detail",
        ]
        read_only_fields = ["id"]