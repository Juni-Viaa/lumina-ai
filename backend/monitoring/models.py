from django.conf import settings
from django.db import models
from django.utils import timezone


class UserTokenUsage(models.Model):
    """Model pelacakan penggunaan token harian per pengguna."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="token_usages",
        db_column="user_id",
    )
    date = models.DateField(default=timezone.localdate, db_index=True)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)
    total_tokens = models.PositiveBigIntegerField(default=0)
    request_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_token_usages"
        ordering = ["-date", "-total_tokens"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_user_daily_token_usage",
            )
        ]
        indexes = [
            models.Index(fields=["user", "date"], name="user_token_usage_user_date_idx"),
            models.Index(fields=["date"], name="user_token_usage_date_idx"),
        ]

    def __str__(self):
        return f"{self.user} - {self.date}: {self.total_tokens} tokens"


class UserRequestLog(models.Model):
    """Model pencatatan setiap permintaan/query pengguna untuk rate limiting & audit."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="request_logs",
        db_column="user_id",
        null=True,
        blank=True,
    )
    query = models.ForeignKey(
        "core.Query",
        on_delete=models.SET_NULL,
        related_name="request_logs",
        db_column="query_id",
        null=True,
        blank=True,
    )
    endpoint = models.CharField(max_length=255)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    status_code = models.IntegerField(default=200)
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_request_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"], name="user_req_log_user_created_idx"),
            models.Index(fields=["created_at"], name="user_req_log_created_idx"),
        ]

    def __str__(self):
        return f"[{self.created_at}] {self.user} {self.endpoint} ({self.status_code})"
