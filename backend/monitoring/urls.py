from django.urls import path
from .views import (
    MonitoringChartsView,
    MyTokenUsageStreamView,
    MyTokenUsageSummaryView,
    QueryLogsListView,
    QueryLogsStreamView,
    TokenUsageSummaryView,
)

urlpatterns = [
    path("monitoring/my-summary/", MyTokenUsageSummaryView.as_view(), name="monitoring-my-summary"),
    path("monitoring/my-summary/stream/", MyTokenUsageStreamView.as_view(), name="monitoring-my-summary-stream"),
    path("monitoring/summary/", TokenUsageSummaryView.as_view(), name="monitoring-summary"),
    path("monitoring/charts/", MonitoringChartsView.as_view(), name="monitoring-charts"),
    path("monitoring/query-logs/", QueryLogsListView.as_view(), name="monitoring-query-logs"),
    path("monitoring/query-logs/stream/", QueryLogsStreamView.as_view(), name="monitoring-query-logs-stream"),
]
