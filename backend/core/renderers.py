"""
renderers.py — Custom DRF renderers for Lumina.
"""

import json
from rest_framework.renderers import BaseRenderer


class ServerSentEventRenderer(BaseRenderer):
    """Renderer for Server-Sent Events (SSE) streaming endpoints.

    Allows DRF content negotiation to succeed when clients send
    Accept: text/event-stream.
    """

    media_type = "text/event-stream"
    format = "event-stream"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode("utf-8")
        return json.dumps(data).encode("utf-8")
