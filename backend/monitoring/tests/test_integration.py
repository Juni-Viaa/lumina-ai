from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from monitoring.models import UserTokenUsage, UserRequestLog
from monitoring.config import RATE_LIMIT_REQUESTS_PER_MINUTE, DAILY_TOKEN_LIMIT_INPUT

User = get_user_model()


class ChatMonitoringIntegrationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="chat_monitor@example.com",
            username="chat_monitor",
            password="password123",
            role=User.Role.MAHASISWA,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("chat.views.run_rag_query")
    def test_ask_view_rate_limit_exceeded(self, mock_rag):
        mock_rag.return_value = {"success": True, "answer": "mocked", "sources": []}
        # Create requests to exhaust rate limit
        for _ in range(RATE_LIMIT_REQUESTS_PER_MINUTE):
            UserRequestLog.objects.create(
                user=self.user,
                endpoint="/api/ask/",
                status_code=200,
            )

        response = self.client.post("/api/ask/", {"question": "Pertanyaan testing?"})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("detail", response.data)
        self.assertIn("Batas frekuensi permintaan", response.data["detail"])
        self.assertIn("Retry-After", response.headers)

    @patch("chat.views.stream_rag_query")
    def test_ask_stream_view_rate_limit_exceeded(self, mock_stream):
        mock_stream.return_value = iter([{"type": "done", "data": {"answer": "mocked"}}])
        for _ in range(RATE_LIMIT_REQUESTS_PER_MINUTE):
            UserRequestLog.objects.create(
                user=self.user,
                endpoint="/api/ask/stream/",
                status_code=200,
            )

        response = self.client.post("/api/ask/stream/", {"question": "Pertanyaan streaming?"})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("detail", response.data)

    @patch("chat.views.run_rag_query")
    def test_ask_view_daily_token_limit_exceeded(self, mock_rag):
        mock_rag.return_value = {"success": True, "answer": "mocked", "sources": []}
        from django.utils import timezone
        UserTokenUsage.objects.create(
            user=self.user,
            date=timezone.localdate(),
            input_tokens=DAILY_TOKEN_LIMIT_INPUT + 10,
            output_tokens=100,
            total_tokens=DAILY_TOKEN_LIMIT_INPUT + 110,
            request_count=5,
        )

        response = self.client.post("/api/ask/", {"question": "Pertanyaan testing kuota?"})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Batas token input harian", response.data["detail"])

    @patch("chat.views.run_rag_query")
    def test_ask_view_records_log_when_rate_limited(self, mock_rag):
        # Exceed limit
        for _ in range(RATE_LIMIT_REQUESTS_PER_MINUTE):
            UserRequestLog.objects.create(
                user=self.user,
                endpoint="/api/ask/",
                status_code=200,
            )

        initial_count = UserRequestLog.objects.filter(user=self.user).count()
        response = self.client.post("/api/ask/", {"question": "Pertanyaan baru?"})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # Should record the rejected request in UserRequestLog
        new_count = UserRequestLog.objects.filter(user=self.user).count()
        self.assertEqual(new_count, initial_count + 1)
        latest = UserRequestLog.objects.filter(user=self.user).latest("created_at")
        self.assertEqual(latest.status_code, 429)


