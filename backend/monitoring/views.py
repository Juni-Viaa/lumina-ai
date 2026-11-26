"""
views.py — Endpoint API monitoring penggunaan token, riwayat permintaan, grafik, dan streaming SSE.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta

from django.db.models import Sum, Count, Q
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from core.renderers import ServerSentEventRenderer
from . import config
from .models import UserRequestLog, UserTokenUsage
from .permissions import IsAdminUserRole
from .serializers import UserRequestLogSerializer, UserTokenUsageSerializer

logger = logging.getLogger(__name__)


class MyTokenUsageSummaryView(APIView):
    """
    GET /api/monitoring/my-summary/
    Ringkasan penggunaan token dan batasan untuk user yang sedang login.
    Dapat diakses oleh seluruh user yang terautentikasi.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        # ponytail: current user daily usage; upgrade to cached aggregates if request volume spikes
        usage = UserTokenUsage.objects.filter(
            user=request.user, date=today, deleted_at__isnull=True
        ).first()

        input_tokens = usage.input_tokens if usage else 0
        output_tokens = usage.output_tokens if usage else 0
        total_tokens = usage.total_tokens if usage else 0
        request_count = usage.request_count if usage else 0

        input_pct = min(100.0, round((input_tokens / config.DAILY_TOKEN_LIMIT_INPUT) * 100, 1))
        output_pct = min(100.0, round((output_tokens / config.DAILY_TOKEN_LIMIT_OUTPUT) * 100, 1))

        return Response({
            "date": str(today),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "request_count": request_count,
            "input_percentage": input_pct,
            "output_percentage": output_pct,
            "limits": {
                "requests_per_minute": config.RATE_LIMIT_REQUESTS_PER_MINUTE,
                "daily_token_limit_input": config.DAILY_TOKEN_LIMIT_INPUT,
                "daily_token_limit_output": config.DAILY_TOKEN_LIMIT_OUTPUT,
            },
        })


class TokenUsageSummaryView(APIView):
    """
    GET /api/monitoring/summary/
    Ringkasan penggunaan token (total input, output, requests, active users, per user breakdown).
    Khusus administrator.
    """

    permission_classes = [IsAdminUserRole]

    def get(self, request):
        today = timezone.localdate()
        date_str = request.query_params.get("date")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        user_id = request.query_params.get("user_id")

        qs = UserTokenUsage.objects.filter(deleted_at__isnull=True).select_related("user")

        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                qs = qs.filter(date__gte=start_date, date__lte=end_date)
            except ValueError:
                return Response(
                    {"detail": "Format start_date atau end_date tidak valid (gunakan YYYY-MM-DD)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                qs = qs.filter(date=target_date)
            except ValueError:
                return Response(
                    {"detail": "Format date tidak valid (gunakan YYYY-MM-DD)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Default hari ini
            qs = qs.filter(date=today)

        if user_id:
            qs = qs.filter(user_id=user_id)

        aggregates = qs.aggregate(
            total_input=Sum("input_tokens"),
            total_output=Sum("output_tokens"),
            total_all=Sum("total_tokens"),
            total_reqs=Sum("request_count"),
            active_users=Count("user", distinct=True),
        )

        total_input = aggregates["total_input"] or 0
        total_output = aggregates["total_output"] or 0
        total_all = aggregates["total_all"] or 0
        total_reqs = aggregates["total_reqs"] or 0
        active_users = aggregates["active_users"] or 0

        # Detail per user
        user_usages = []
        for usage in qs.order_by("-total_tokens"):
            input_pct = min(100.0, round((usage.input_tokens / config.DAILY_TOKEN_LIMIT_INPUT) * 100, 1))
            output_pct = min(100.0, round((usage.output_tokens / config.DAILY_TOKEN_LIMIT_OUTPUT) * 100, 1))
            user_usages.append({
                "user_id": usage.user_id,
                "username": usage.user.username,
                "email": usage.user.email,
                "role": usage.user.role,
                "date": str(usage.date),
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "total_tokens": usage.total_tokens,
                "request_count": usage.request_count,
                "input_percentage": input_pct,
                "output_percentage": output_pct,
            })

        return Response({
            "date": date_str or str(today),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_tokens": total_all,
            "total_requests": total_reqs,
            "active_users_count": active_users,
            "limits": {
                "requests_per_minute": config.RATE_LIMIT_REQUESTS_PER_MINUTE,
                "daily_token_limit_input": config.DAILY_TOKEN_LIMIT_INPUT,
                "daily_token_limit_output": config.DAILY_TOKEN_LIMIT_OUTPUT,
            },
            "users": user_usages,
        })


class MonitoringChartsView(APIView):
    """
    GET /api/monitoring/charts/
    Tren penggunaan token dan request harian untuk grafik visualisasi.
    Khusus administrator.
    """

    permission_classes = [IsAdminUserRole]

    def get(self, request):
        today = timezone.localdate()
        try:
            days = min(90, max(1, int(request.query_params.get("days", 7))))
        except (ValueError, TypeError):
            days = 7

        user_id = request.query_params.get("user_id")
        start_date = today - timedelta(days=days - 1)

        qs = UserTokenUsage.objects.filter(
            date__gte=start_date,
            date__lte=today,
            deleted_at__isnull=True,
        ).select_related("user")

        if user_id:
            qs = qs.filter(user_id=user_id)

        # Kelompokkan per tanggal
        daily_map: dict[str, dict] = {}
        curr = start_date
        while curr <= today:
            d_str = str(curr)
            daily_map[d_str] = {
                "date": d_str,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "request_count": 0,
            }
            curr += timedelta(days=1)

        for u in qs:
            d_str = str(u.date)
            if d_str in daily_map:
                daily_map[d_str]["input_tokens"] += u.input_tokens
                daily_map[d_str]["output_tokens"] += u.output_tokens
                daily_map[d_str]["total_tokens"] += u.total_tokens
                daily_map[d_str]["request_count"] += u.request_count

        daily_trends = list(daily_map.values())

        # Top users by total tokens in this period
        user_aggregates = (
            qs.values("user__id", "user__username", "user__email", "user__role")
            .annotate(
                tokens=Sum("total_tokens"),
                reqs=Sum("request_count"),
                inputs=Sum("input_tokens"),
                outputs=Sum("output_tokens"),
            )
            .order_by("-tokens")[:10]
        )

        top_users = [
            {
                "user_id": item["user__id"],
                "username": item["user__username"],
                "email": item["user__email"],
                "role": item["user__role"],
                "total_tokens": item["tokens"] or 0,
                "request_count": item["reqs"] or 0,
                "input_tokens": item["inputs"] or 0,
                "output_tokens": item["outputs"] or 0,
            }
            for item in user_aggregates
        ]

        return Response({
            "period_days": days,
            "start_date": str(start_date),
            "end_date": str(today),
            "daily_trends": daily_trends,
            "top_users": top_users,
        })


class QueryLogsListView(generics.ListAPIView):
    """
    GET /api/monitoring/query-logs/
    Daftar log request seluruh pengguna, terurut dari yang terbaru.
    Khusus administrator.
    """

    permission_classes = [IsAdminUserRole]
    serializer_class = UserRequestLogSerializer

    def get_queryset(self):
        qs = (
            UserRequestLog.objects.filter(deleted_at__isnull=True)
            .select_related("user", "query")
            .order_by("-created_at")
        )

        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)

        status_code = self.request.query_params.get("status_code")
        if status_code:
            qs = qs.filter(status_code=status_code)

        date_str = self.request.query_params.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                qs = qs.filter(created_at__date=target_date)
            except ValueError:
                pass

        return qs


class QueryLogsStreamView(APIView):
    """
    GET /api/monitoring/query-logs/stream/
    Server-Sent Events (SSE) endpoint untuk pembaruan real-time seluruh aktivitas query pengguna.
    Khusus administrator.
    """

    permission_classes = [IsAdminUserRole]
    renderer_classes = [ServerSentEventRenderer, JSONRenderer]

    def get(self, request, *args, **kwargs):
        def event_stream():
            last_id = (
                UserRequestLog.objects.order_by("-id").values_list("id", flat=True).first()
                or 0
            )

            # Stream selama ~45 detik (30 iterasi * 1.5 detik), browser EventSource akan auto-reconnect
            for _ in range(30):
                new_logs = list(
                    UserRequestLog.objects.filter(id__gt=last_id, deleted_at__isnull=True)
                    .select_related("user", "query")
                    .order_by("id")
                )
                if new_logs:
                    for log in new_logs:
                        last_id = max(last_id, log.id)
                        data = UserRequestLogSerializer(log).data
                        yield f"data: {json.dumps({'type': 'new_log', 'data': data})}\n\n"

                yield ": keep-alive\n\n"
                time.sleep(1.5)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
