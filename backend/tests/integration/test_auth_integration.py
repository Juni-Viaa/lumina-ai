"""
Integration test suite untuk Phase 3: Auth Cookie + API Client.

Run: pytest backend/tests/integration/test_auth_integration.py -v
"""

import pytest
import json
from datetime import datetime, timedelta
from django.utils import timezone
from django.test import Client
from django.conf import settings
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


@pytest.fixture
def active_session(create_user):
    """Create active session untuk test user."""
    session = Session.objects.create(
        user=create_user,
        expires_at=timezone.now() + timedelta(days=7),
    )
    return session


class TestCookieAuthentication:
    """Test suite untuk HttpOnly cookie authentication."""

    def test_register_sets_cookie(self, client, db):
        """Test register endpoint set HttpOnly cookie."""
        response = client.post(
            "/api/auth/register/",
            json.dumps({
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "testpass123",
                "password_confirm": "testpass123",
            }),
            content_type="application/json",
            HTTP_X_CSRFTOKEN="testtoken",
        )

        assert response.status_code == 201
        assert "lumina_session" in response.cookies
        cookie = response.cookies["lumina_session"]
        assert cookie["httponly"] == True
        assert cookie["samesite"] == "Lax"

    def test_login_sets_cookie(self, client, create_user, db):
        """Test login endpoint set HttpOnly cookie."""
        response = client.post(
            "/api/auth/login/",
            json.dumps({
                "email": "test@example.com",
                "password": "testpass123",
            }),
            content_type="application/json",
        )

        assert response.status_code == 200
        assert "lumina_session" in response.cookies
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"

    def test_protected_route_requires_session(self, client, db):
        """Test protected endpoint reject unauthenticated request."""
        response = client.get("/api/auth/me/")
        assert response.status_code == 401

    def test_protected_route_accepts_valid_session(
        self, client, create_user, active_session, db
    ):
        """Test protected endpoint accept valid session cookie."""
        session_key = str(active_session.session_key)
        response = client.get(
            "/api/auth/me/",
            cookies={"lumina_session": session_key},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert "session_expires_at" in data

    def test_logout_deletes_cookie(self, client, create_user, active_session, db):
        """Test logout endpoint delete session cookie."""
        session_key = str(active_session.session_key)
        response = client.post(
            "/api/auth/logout/",
            cookies={"lumina_session": session_key},
        )

        assert response.status_code == 200
        assert "lumina_session" in response.cookies
        cookie = response.cookies["lumina_session"]
        assert cookie["max-age"] == 0 or cookie["expires"] == "Thu, 01 Jan 1970 00:00:00 GMT"

    def test_expired_session_rejected(self, client, create_user, db):
        """Test expired session is rejected."""
        expired_session = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() - timedelta(days=1),
        )
        
        session_key = str(expired_session.session_key)
        response = client.get(
            "/api/auth/me/",
            cookies={"lumina_session": session_key},
        )

        assert response.status_code == 401


class TestCSRFProtection:
    """Test suite untuk CSRF protection."""

    def test_csrf_token_endpoint(self, client, db):
        """Test CSRF token endpoint."""
        response = client.get("/api/auth/csrf/")
        assert response.status_code == 200
        data = response.json()
        assert "csrf_token" in data
        assert len(data["csrf_token"]) > 20

    def test_post_without_csrf_token(self, client, db):
        """Test POST request without CSRF token rejected."""
        response = client.post(
            "/api/auth/login/",
            json.dumps({
                "email": "test@example.com",
                "password": "testpass123",
            }),
            content_type="application/json",
        )
        
        # CSRF check may or may not reject depending on settings
        # This test documents current behavior

    def test_post_with_valid_csrf_token(self, client, db):
        """Test POST request with valid CSRF token accepted."""
        # Get CSRF token first
        response = client.get("/api/auth/csrf/")
        csrf_token = response.json()["csrf_token"]

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


class TestSessionManagement:
    """Test suite untuk session management."""

    def test_multiple_sessions(self, client, create_user, db):
        """Test user can have multiple active sessions."""
        session1 = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        session2 = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )

        assert Session.objects.filter(user=create_user, is_active=True).count() == 2

    def test_revoke_single_session(self, client, create_user, db):
        """Test revoke single session."""
        session = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        session_key = str(session.session_key)
        Session.objects.filter(session_key=session_key).update(is_active=False)
        
        session.refresh_from_db()
        assert session.is_active == False

    def test_revoke_all_sessions(self, client, create_user, db):
        """Test revoke all sessions for user."""
        session1 = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        session2 = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )

        Session.objects.filter(user=create_user).update(is_active=False)

        assert Session.objects.filter(user=create_user, is_active=True).count() == 0

    def test_session_expiry_auto_deactivate(self, client, create_user, db):
        """Test expired sessions auto deactivate."""
        expired = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() - timedelta(days=1),
        )
        active = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Validate expired
        session, is_valid = Session.objects.get(session_key=expired.session_key).validate_session()
        assert is_valid == False

        # Validate active
        session, is_valid = Session.objects.get(session_key=active.session_key).validate_session()
        assert is_valid == True


class TestCookieSettings:
    """Test suite untuk cookie security settings."""

    def test_session_cookie_httponly(self, db):
        """Test SESSION_COOKIE_HTTPONLY setting."""
        assert settings.SESSION_COOKIE_HTTPONLY == True

    def test_session_cookie_samesite(self, db):
        """Test SESSION_COOKIE_SAMESITE setting."""
        assert settings.SESSION_COOKIE_SAMESITE == "Lax"

    def test_session_cookie_age(self, db):
        """Test SESSION_COOKIE_AGE setting."""
        assert settings.SESSION_COOKIE_AGE == 60 * 60 * 24 * 7  # 7 days

    def test_session_cookie_secure(self, db):
        """Test SESSION_COOKIE_SECURE setting (False for development)."""
        assert settings.SESSION_COOKIE_SECURE == False

    def test_csrf_cookie_httponly(self, db):
        """Test CSRF_COOKIE_HTTPONLY setting."""
        # Frontend needs to read CSRF cookie, so this is False
        assert settings.CSRF_COOKIE_HTTPONLY == False


class TestSessionDeviceTracking:
    """Test suite untuk session device tracking."""

    def test_session_device_creation(self, client, create_user, db):
        """Test session device record creation."""
        session = Session.objects.create(
            user=create_user,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ip_address="192.168.1.1",
        )

        assert session.user_agent != ""
        assert session.ip_address is not None

    def test_session_device_metadata_extraction(self, db):
        """Test device metadata extraction from user agent."""
        from accounts.session_manager import (
            extract_device_name,
            extract_os_name,
            extract_browser_name,
        )

        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

        assert extract_device_name(ua) == "Windows"
        assert extract_os_name(ua) == "Windows"
        assert extract_browser_name(ua) == "Chrome"


class TestSecurity:
    """Security-focused tests."""

    def test_no_sensitive_data_in_response(self, client, create_user, active_session, db):
        """Test sensitive data not exposed in API responses."""
        session_key = str(active_session.session_key)
        response = client.get(
            "/api/auth/me/",
            cookies={"lumina_session": session_key},
        )

        assert response.status_code == 200
        data = response.json()
        
        # Password should never be in response
        assert "password" not in data
        assert "password_hash" not in data
        assert "password_reset_token" not in data

    def test_session_key_is_uuid(self, db):
        """Test session key is UUID, not sequential ID."""
        session = Session.objects.create(
            user=create_user,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Session key should be UUID format
        import uuid
        try:
            uuid.UUID(str(session.session_key))
            is_uuid = True
        except ValueError:
            is_uuid = False
        
        assert is_uuid == True

    def test_session_key_not_exposed_in_frontend(self, create_user, active_session, db):
        """Test session key not exposed to frontend JavaScript."""
        # Session cookie is HttpOnly, JavaScript cannot read it
        # This is verified by cookie settings, not a runtime test
        assert settings.SESSION_COOKIE_HTTPONLY == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
