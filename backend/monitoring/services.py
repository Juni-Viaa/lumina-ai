"""
services.py — Layanan monitoring token, rate limiting sliding-window, dan pencatatan audit log.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from . import config
from .models import UserRequestLog, UserTokenUsage

logger = logging.getLogger(__name__)


def estimate_tokens(text: str | None) -> int:
    """Estimasi jumlah token dari teks (rata-rata 1 token per 3.5 karakter)."""
    if not text:
        return 0
    cleaned = text.strip()
    if not cleaned:
        return 0
    # Minimal 1 token jika ada teks
    return max(1, int(len(cleaned) / 3.5))


def check_rate_limit(user: Any) -> tuple[bool, str | None, int]:
    """
    Periksa batas frekuensi permintaan (Rate Limiting) per pengguna menggunakan algoritma sliding window.
    
    Menghitung jumlah permintaan dalam window 60 detik terakhir.
    Returns: (is_allowed, error_message, retry_after_seconds)
    """
    if not user or not user.is_authenticated:
        return True, None, 0

    now = timezone.now()
    window_start = now - timedelta(seconds=config.RATE_LIMIT_WINDOW_SECONDS)

    recent_requests = UserRequestLog.objects.filter(
        user=user,
        created_at__gte=window_start,
        deleted_at__isnull=True,
    ).order_by("created_at")

    req_count = recent_requests.count()

    if req_count >= config.RATE_LIMIT_REQUESTS_PER_MINUTE:
        oldest = recent_requests.first()
        if oldest:
            elapsed = (now - oldest.created_at).total_seconds()
            retry_after = max(1, int(config.RATE_LIMIT_WINDOW_SECONDS - elapsed) + 1)
        else:
            retry_after = config.RATE_LIMIT_WINDOW_SECONDS

        logger.warning(
            "Rate limit exceeded for user %s (%s requests in %ss, limit %s)",
            user.id,
            req_count,
            config.RATE_LIMIT_WINDOW_SECONDS,
            config.RATE_LIMIT_REQUESTS_PER_MINUTE,
        )
        return False, config.RATE_LIMIT_ERROR_MESSAGE, retry_after

    return True, None, 0


def check_daily_token_limit(user: Any, estimated_input_tokens: int = 0) -> tuple[bool, str | None]:
    """
    Periksa apakah penggunaan token harian pengguna telah melampaui batas kuota.
    
    Batas direset setiap pergantian hari berdasarkan zona waktu lokal (Asia/Jakarta).
    Returns: (is_allowed, error_message)
    """
    if not user or not user.is_authenticated:
        return True, None

    today = timezone.localdate()
    usage = UserTokenUsage.objects.filter(
        user=user,
        date=today,
        deleted_at__isnull=True,
    ).first()

    if not usage:
        return True, None

    if usage.input_tokens + estimated_input_tokens > config.DAILY_TOKEN_LIMIT_INPUT:
        logger.warning(
            "Daily input token limit exceeded for user %s: %s + %s > %s",
            user.id,
            usage.input_tokens,
            estimated_input_tokens,
            config.DAILY_TOKEN_LIMIT_INPUT,
        )
        return False, config.DAILY_INPUT_LIMIT_ERROR_MESSAGE

    if usage.output_tokens >= config.DAILY_TOKEN_LIMIT_OUTPUT:
        logger.warning(
            "Daily output token limit reached for user %s: %s >= %s",
            user.id,
            usage.output_tokens,
            config.DAILY_TOKEN_LIMIT_OUTPUT,
        )
        return False, config.DAILY_OUTPUT_LIMIT_ERROR_MESSAGE

    return True, None


def record_request_log(
    user: Any = None,
    endpoint: str = "",
    query: Any = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    status_code: int = 200,
    response_time_ms: int | None = None,
    error_message: str | None = None,
) -> UserRequestLog:
    """Catat permintaan ke dalam UserRequestLog untuk sliding-window rate limit dan audit."""
    actual_user = user if (user and getattr(user, "is_authenticated", False)) else None
    return UserRequestLog.objects.create(
        user=actual_user,
        query=query,
        endpoint=endpoint,
        input_tokens=max(0, input_tokens),
        output_tokens=max(0, output_tokens),
        status_code=status_code,
        response_time_ms=response_time_ms,
        error_message=error_message,
    )


def record_token_usage(
    user: Any,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> UserTokenUsage | None:
    """
    Akumulasikan penggunaan token harian pengguna secara atomik.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None

    today = timezone.localdate()
    safe_input = max(0, input_tokens)
    safe_output = max(0, output_tokens)
    total = safe_input + safe_output

    with transaction.atomic():
        usage, created = UserTokenUsage.objects.select_for_update().get_or_create(
            user=user,
            date=today,
            defaults={
                "input_tokens": safe_input,
                "output_tokens": safe_output,
                "total_tokens": total,
                "request_count": 1,
            },
        )
        if not created:
            UserTokenUsage.objects.filter(pk=usage.pk).update(
                input_tokens=F("input_tokens") + safe_input,
                output_tokens=F("output_tokens") + safe_output,
                total_tokens=F("total_tokens") + total,
                request_count=F("request_count") + 1,
                updated_at=timezone.now(),
            )
            usage.refresh_from_db()

    return usage


def check_request_limits(user: Any, estimated_input_tokens: int = 0) -> tuple[bool, str | None, int, int]:
    """
    Periksa rate limit dan token limit harian sekaligus.
    Returns: (is_allowed, error_message, http_status_code, retry_after)
    """
    allowed, rate_msg, retry_after = check_rate_limit(user)
    if not allowed:
        return False, rate_msg, 429, retry_after

    allowed, token_msg = check_daily_token_limit(user, estimated_input_tokens)
    if not allowed:
        return False, token_msg, 429, 0

    return True, None, 200, 0


def get_user_usage_summary(user: Any) -> dict[str, Any]:
    """
    Ambil ringkasan penggunaan token dan rate limit sliding-window untuk pengguna.
    Dapat digunakan baik oleh endpoint REST (MyTokenUsageSummaryView) maupun SSE stream.
    """
    today = timezone.localdate()
    now = timezone.now()
    window_start = now - timedelta(seconds=config.RATE_LIMIT_WINDOW_SECONDS)

    usage = None
    if user and getattr(user, "is_authenticated", False):
        usage = UserTokenUsage.objects.filter(
            user=user, date=today, deleted_at__isnull=True
        ).first()

    input_tokens = usage.input_tokens if usage else 0
    output_tokens = usage.output_tokens if usage else 0
    total_tokens = usage.total_tokens if usage else 0
    request_count = usage.request_count if usage else 0

    # Hitung request dalam sliding window 60 detik terakhir
    current_requests = 0
    if user and getattr(user, "is_authenticated", False):
        current_requests = UserRequestLog.objects.filter(
            user=user,
            created_at__gte=window_start,
            deleted_at__isnull=True,
        ).count()

    input_pct = (
        min(100.0, round((input_tokens / config.DAILY_TOKEN_LIMIT_INPUT) * 100, 1))
        if config.DAILY_TOKEN_LIMIT_INPUT > 0
        else 0.0
    )
    output_pct = (
        min(100.0, round((output_tokens / config.DAILY_TOKEN_LIMIT_OUTPUT) * 100, 1))
        if config.DAILY_TOKEN_LIMIT_OUTPUT > 0
        else 0.0
    )
    requests_pct = (
        min(100.0, round((current_requests / config.RATE_LIMIT_REQUESTS_PER_MINUTE) * 100, 1))
        if config.RATE_LIMIT_REQUESTS_PER_MINUTE > 0
        else 0.0
    )

    return {
        "date": str(today),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "request_count": request_count,
        "current_requests": current_requests,
        "requests_percentage": requests_pct,
        "input_percentage": input_pct,
        "output_percentage": output_pct,
        "limits": {
            "requests_per_minute": config.RATE_LIMIT_REQUESTS_PER_MINUTE,
            "daily_token_limit_input": config.DAILY_TOKEN_LIMIT_INPUT,
            "daily_token_limit_output": config.DAILY_TOKEN_LIMIT_OUTPUT,
        },
    }


