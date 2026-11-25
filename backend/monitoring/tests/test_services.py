from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class RateLimitAndTokenServicesTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="service_test@example.com",
            username="service_test",
            password="password123",
            role=User.Role.MAHASISWA,
        )

    def test_estimate_tokens(self):
        from monitoring.services import estimate_tokens

        self.assertEqual(estimate_tokens(""), 0)
        self.assertGreaterEqual(estimate_tokens("Halo apa kabar?"), 1)

    def test_check_rate_limit_sliding_window(self):
        from monitoring.services import check_rate_limit, record_request_log
        from monitoring.config import RATE_LIMIT_REQUESTS_PER_MINUTE

        # 0 requests: should be allowed
        allowed, msg, retry_after = check_rate_limit(self.user)
        self.assertTrue(allowed)
        self.assertIsNone(msg)

        # Create RATE_LIMIT_REQUESTS_PER_MINUTE requests
        for i in range(RATE_LIMIT_REQUESTS_PER_MINUTE):
            record_request_log(user=self.user, endpoint="/api/ask/", status_code=200)

        # Next request should be rate limited
        allowed, msg, retry_after = check_rate_limit(self.user)
        self.assertFalse(allowed)
        self.assertIn("Batas frekuensi permintaan tercapai", msg)
        self.assertGreater(retry_after, 0)

    def test_check_daily_token_limit(self):
        from monitoring.services import check_daily_token_limit, record_token_usage
        from monitoring.config import DAILY_TOKEN_LIMIT_INPUT, DAILY_TOKEN_LIMIT_OUTPUT

        # Initial check: allowed
        allowed, msg = check_daily_token_limit(self.user)
        self.assertTrue(allowed)
        self.assertIsNone(msg)

        # Exceed input token limit
        record_token_usage(self.user, input_tokens=DAILY_TOKEN_LIMIT_INPUT + 10, output_tokens=0)
        allowed, msg = check_daily_token_limit(self.user)
        self.assertFalse(allowed)
        self.assertIn("input", msg.lower())

    def test_record_token_usage_atomic_accumulation(self):
        from monitoring.services import record_token_usage
        from monitoring.models import UserTokenUsage

        today = timezone.localdate()
        record_token_usage(self.user, input_tokens=100, output_tokens=50)
        record_token_usage(self.user, input_tokens=200, output_tokens=100)

        usage = UserTokenUsage.objects.get(user=self.user, date=today)
        self.assertEqual(usage.input_tokens, 300)
        self.assertEqual(usage.output_tokens, 150)
        self.assertEqual(usage.total_tokens, 450)
        self.assertEqual(usage.request_count, 2)

    def test_check_request_limits_composite(self):
        from monitoring.services import check_request_limits, record_token_usage
        from monitoring.config import DAILY_TOKEN_LIMIT_INPUT

        ok, msg, status_code, retry_after = check_request_limits(self.user)
        self.assertTrue(ok)
        self.assertEqual(status_code, 200)

        # Trigger token limit
        record_token_usage(self.user, input_tokens=DAILY_TOKEN_LIMIT_INPUT + 1)
        ok, msg, status_code, retry_after = check_request_limits(self.user)
        self.assertFalse(ok)
        self.assertEqual(status_code, 429)
        self.assertIn("input", msg.lower())

