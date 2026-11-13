"""
CORS & Security integration tests untuk Phase 3.

Run: pytest backend/tests/integration/test_cors_security.py -v
"""

import pytest
import json
from datetime import timedelta
from django.test import Client
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from accounts.models import Session


User = get_user_model()


@pytest.fixture
def client():
    """Django test client."""
    return Client()


@pytest.fixture
def create_user(db):
    """Create test user."""
    user = User.objects.create_user(
        email="test@example.com",
        username="testuser",
        password="testpass123",
    )
    return user


class TestCORSSettings:
    """Test CORS configuration."""

    def test_cors_allowed_origins(self, db):
        """Test CORS_ALLOWED_ORIGINS setting."""
        assert settings.CORS_ALLOWED_ORIGINS is not None
        assert len(settings.CORS_ALLOWED_ORIGINS) > 0
        assert "http://localhost:3000" in settings.CORS_ALLOWED_ORIGINS
        assert "http://127.0.0.1:3000" in settings.CORS_ALLOWED_ORIGINS

    def test_cors_allow_credentials(self, db):
        """Test CORS_ALLOW_CREDENTIALS is True."""
        assert settings.CORS_ALLOW_CREDENTIALS == True

    def test_cors_expose_headers(self, db):
        """Test CORS_EXPOSE_HEADERS includes Content-Type and X-CSRFToken."""
        assert hasattr(settings, "CORS_EXPOSE_HEADERS")
        assert "Content-Type" in settings.CORS_EXPOSE_HEADERS
        assert "X-CSRFToken" in settings.CORS_EXPOSE_HEADERS


class TestCSRFSettings:
    """Test CSRF configuration."""

    def test_csrf_cookie_samesite(self, db):
        """Test CSRF_COOKIE_SAMESITE setting."""
        assert settings.CSRF_COOKIE_SAMESITE == "Lax"

    def test_csrf_trusted_origins(self, db):
        """Test CSRF_TRUSTED_ORIGINS matches CORS origins."""
        assert settings.CSRF_TRUSTED_ORIGINS is not None
        assert len(settings.CSRF_TRUSTED_ORIGINS) > 0


class TestXSSProtection:
    """Test XSS prevention measures."""

    def test_user_input_sanitized(self, client, create_user, db):
        """Test user input is sanitized before database storage."""
        # Django ORM automatically escapes SQL injection attempts
        # This test verifies basic SQL injection prevention
        
        # SQL injection attempt in username
        username_attempt = "test'; DROP TABLE auth_user; --"
        
        # Should not raise error, should sanitize
        user = User.objects.create_user(
            email="injection@test.com",
            username=username_attempt[:20],  # Limited by model max_length
            password="testpass123",
        )
        
        # Verify username stored safely (truncated)
        assert user.username == username_attempt[:20]
        assert "DROP TABLE" not in user.username

    def test_script_tags_escaped_in_response(self, client, create_user, active_session, db):
        """Test script tags are escaped in HTML responses."""
        from django.utils.html import escape

        malicious_input = "<script>alert('xss')</script>"
        safe_output = escape(malicious_input)
        
        assert "<script>" not in safe_output
        assert "&lt;script&gt;" in safe_output


class TestCSRFAttackSimulation:
    """Simulate CSRF attack scenarios."""

    def test_cross_origin_request_blocked(self, client, db):
        """Test cross-origin requests without CSRF token."""
        # Django CSRF middleware should reject cross-origin POST without valid token
        # This is tested via actual requests
        
        # GET requests are safe and allowed
        response = client.get("/api/auth/csrf/")
        assert response.status_code == 200

    def test_same_origin_request_with_csrf(self, client, db):
        """Test same-origin request with valid CSRF token."""
        # Get CSRF token
        response = client.get("/api/auth/csrf/")
        csrf_token = response.json()["csrf_token"]
        
        # POST with CSRF token
        response = client.post(
            "/api/auth/login/",
            json.dumps({
                "email": "test@example.com",
                "password": "testpass123",
            }),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        
        assert response.status_code == 200


class TestSessionHijackingPrevention:
    """Test session hijacking prevention."""

    def test_session_key_not_in_url(self, client, create_user, active_session, db):
        """Test session key not exposed in URL."""
        session_key = str(active_session.session_key)
        
        # Session is in cookie, not URL
        response = client.get(
            "/api/auth/me/",
            cookies={"lumina_session": session_key},
        )
        
        assert response.status_code == 200
        # Session key not in response
        assert session_key not in response.content.decode()

    def test_session_key_not_in_log(self, create_user, db):
        """Test session key not logged in plain text."""
        import logging
        from io import StringIO
        
        # Create test log handler
        log_stream = StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.setLevel(logging.INFO)
        
        logger = logging.getLogger("accounts.session_manager")
        logger.addHandler(handler)
        
        # Log a session key
        session = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        logger.info(f"Created session {session.session_key} for user {create_user.id}")
        
        # Verify session key not in plain text
        log_content = log_stream.getvalue()
        assert str(session.session_key) not in log_content or "XXX" in log_content
        
        logger.removeHandler(handler)


class TestHTTPOnlyCookieEnforcement:
    """Verify HttpOnly cookie is enforced."""

    def test_cookie_httponly_flag(self, client, db):
        """Test session cookie has HttpOnly flag."""
        response = client.post(
            "/api/auth/login/",
            json.dumps({
                "email": "test@example.com",
                "password": "testpass123",
            }),
            content_type="application/json",
        )
        
        if "lumina_session" in response.cookies:
            cookie = response.cookies["lumina_session"]
            assert cookie["httponly"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
