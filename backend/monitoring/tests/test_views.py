from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from monitoring.models import UserTokenUsage, UserRequestLog
from core.models import Query

User = get_user_model()


class MonitoringApiEndpointsTest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin_mon@example.com",
            username="admin_mon",
            password="password123",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.mahasiswa = User.objects.create_user(
            email="mhs_mon@example.com",
            username="mhs_mon",
            password="password123",
            role=User.Role.MAHASISWA,
        )

        today = timezone.localdate()
        UserTokenUsage.objects.create(
            user=self.mahasiswa,
            date=today,
            input_tokens=1500,
            output_tokens=800,
            total_tokens=2300,
            request_count=3,
        )
        UserRequestLog.objects.create(
            user=self.mahasiswa,
            endpoint="/api/ask/",
            input_tokens=500,
            output_tokens=200,
            status_code=200,
            response_time_ms=850,
        )

    def test_summary_requires_admin_role(self):
        # Non-admin / mahasiswa should be forbidden (403)
        self.client.force_authenticate(user=self.mahasiswa)
        response = self.client.get("/api/monitoring/summary/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_summary_success_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/monitoring/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("total_input_tokens", data)
        self.assertIn("total_output_tokens", data)
        self.assertIn("total_requests", data)
        self.assertIn("users", data)
        self.assertGreaterEqual(data["total_tokens"], 2300)

    def test_charts_data_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/monitoring/charts/?days=7")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("daily_trends", data)
        self.assertIn("top_users", data)

    def test_query_logs_list_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/monitoring/query-logs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 1)

    def test_my_summary_success_for_authenticated_user(self):
        self.client.force_authenticate(user=self.mahasiswa)
        response = self.client.get("/api/monitoring/my-summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["input_tokens"], 1500)
        self.assertEqual(data["output_tokens"], 800)
        self.assertEqual(data["total_tokens"], 2300)
        self.assertEqual(data["request_count"], 3)
        self.assertIn("limits", data)
        self.assertIn("requests_per_minute", data["limits"])

    def test_my_summary_unauthenticated_forbidden(self):
        response = self.client.get("/api/monitoring/my-summary/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
