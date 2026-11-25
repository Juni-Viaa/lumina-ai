"""
serializers.py — Serializer untuk data monitoring token dan riwayat request log.
"""

from rest_framework import serializers
from .models import UserTokenUsage, UserRequestLog


class UserTokenUsageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = UserTokenUsage
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "role",
            "date",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "request_count",
            "created_at",
            "updated_at",
        ]


class UserRequestLogSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)
    query_title = serializers.CharField(source="query.query_title", read_only=True, default=None)
    query_text = serializers.CharField(source="query.query_text", read_only=True, default=None)

    class Meta:
        model = UserRequestLog
        fields = [
            "id",
            "user_id",
            "user_email",
            "user_username",
            "user_role",
            "query_id",
            "query_title",
            "query_text",
            "endpoint",
            "input_tokens",
            "output_tokens",
            "status_code",
            "response_time_ms",
            "error_message",
            "created_at",
        ]
