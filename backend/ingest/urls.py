"""
urls.py — URL routing for the ingest app.
"""

from django.urls import path

from .views import IngestUploadView

urlpatterns = [
    path("ingest/upload/", IngestUploadView.as_view(), name="ingest-upload"),
]