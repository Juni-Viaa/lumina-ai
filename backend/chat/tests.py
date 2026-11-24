from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Conversation

User = get_user_model()


class ConversationAccessControlTestCase(TestCase):
    """Pengujian hak akses conversation: user hanya melihat milik sendiri, admin juga tidak boleh."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="password123",
            role=User.Role.ADMIN,
        )
        self.user_a = User.objects.create_user(
            email="usera@example.com",
            username="usera",
            password="password123",
            role=User.Role.MAHASISWA,
        )
        self.user_b = User.objects.create_user(
            email="userb@example.com",
            username="userb",
            password="password123",
            role=User.Role.MAHASISWA,
        )
        self.conv_a = Conversation.objects.create(user=self.user_a, title="Conversation A")
        self.conv_b = Conversation.objects.create(user=self.user_b, title="Conversation B")
        self.client = APIClient()

    def test_user_can_see_own_conversation(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f"/api/conversations/{self.conv_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_cannot_see_other_user_conversation(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f"/api/conversations/{self.conv_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_cannot_see_other_user_conversation(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/conversations/{self.conv_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_cannot_see_another_user_conversation_in_list(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/conversations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["results"]]
        self.assertNotIn(self.conv_a.id, ids)
        self.assertNotIn(self.conv_b.id, ids)


class StreamViewsContentNegotiationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="streamer@example.com",
            username="streamer",
            password="password123",
            role=User.Role.MAHASISWA,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_ask_stream_accepts_event_stream_header(self):
        """Verifikasi bahwa POST /api/ask/stream/ menerima header Accept: text/event-stream tanpa 406."""
        with patch("chat.views.stream_rag_query") as mock_stream:
            mock_stream.return_value = iter([
                {"type": "step", "step": "embedding", "message": "Embedding query..."},
                {"type": "token", "token": "Halo"},
                {"type": "done", "data": {"answer": "Halo", "sources": []}},
            ])
            response = self.client.post(
                "/api/ask/stream/",
                {"question": "Apa itu Lumina?"},
                format="json",
                HTTP_ACCEPT="text/event-stream",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response["Content-Type"], "text/event-stream")
            content = b"".join(response.streaming_content).decode("utf-8")
            self.assertIn("data: ", content)
            self.assertIn("embedding", content)

    def test_ask_stream_empty_question_validation(self):
        """Verifikasi validasi pertanyaan kosong tetap mengembalikan 400 dengan JSON."""
        response = self.client.post(
            "/api/ask/stream/",
            {"question": "   "},
            format="json",
            HTTP_ACCEPT="text/event-stream",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_document_stream_accepts_event_stream_header(self):
        """Verifikasi bahwa GET /api/documents/stream/ menerima header Accept: text/event-stream tanpa 406."""
        response = self.client.get(
            "/api/documents/stream/",
            HTTP_ACCEPT="text/event-stream",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/event-stream")
