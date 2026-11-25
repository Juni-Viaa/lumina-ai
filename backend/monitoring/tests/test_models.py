import pytest
from datetime import date
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class MonitoringModelsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test_monitoring@example.com",
            username="test_monitoring",
            password="password123",
            role=User.Role.MAHASISWA,
        )

    def test_create_user_token_usage(self):
        from monitoring.models import UserTokenUsage

        today = timezone.localdate()
        usage = UserTokenUsage.objects.create(
            user=self.user,
            date=today,
            input_tokens=150,
            output_tokens=75,
            total_tokens=225,
            request_count=1,
        )
        self.assertEqual(usage.user, self.user)
        self.assertEqual(usage.input_tokens, 150)
        self.assertEqual(usage.output_tokens, 75)
        self.assertEqual(usage.total_tokens, 225)
        self.assertIsNone(usage.deleted_at)
        self.assertEqual(UserTokenUsage._meta.db_table, "user_token_usages")

    def test_create_user_request_log(self):
        from monitoring.models import UserRequestLog

        log = UserRequestLog.objects.create(
            user=self.user,
            endpoint="/api/ask/",
            input_tokens=100,
            output_tokens=50,
            status_code=200,
            response_time_ms=1200,
        )
        self.assertEqual(log.user, self.user)
        self.assertEqual(log.endpoint, "/api/ask/")
        self.assertIsNone(log.deleted_at)
        self.assertEqual(UserRequestLog._meta.db_table, "user_request_logs")
