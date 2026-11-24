from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import DocumentViewSet, ChunkViewSet, IngestLogViewSet, DocumentStreamView

router = DefaultRouter()
router.register(r"documents", DocumentViewSet, basename="document")
router.register(r"chunks", ChunkViewSet, basename="chunk")
router.register(r"ingest-logs", IngestLogViewSet, basename="ingest-log")

urlpatterns = [
    path("documents/stream/", DocumentStreamView.as_view(), name="document-stream"),
    path("", include(router.urls)),
]