"""
Session models untuk HttpOnly Cookie authentication.
"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def get_default_session_expiry():
    """Default expiry: 7 days from now."""
    return timezone.now() + timedelta(seconds=settings.SESSION_COOKIE_AGE)


class Session(models.Model):
    """
    Session model untuk menyimpan active sessions user.
    
    Ini menggantikan TokenAuthentication untuk web client,
    dengan session disimpan di HttpOnly cookie.
    
    User bisa punya multiple active sessions (multi-device support).
    """
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
        db_column="user_id",
    )
    session_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=get_default_session_expiry)
    last_activity = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Device metadata (optional, untuk audit & session management)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_fingerprint = models.CharField(max_length=64, blank=True)
    
    class Meta:
        db_table = "auth_sessions"
        ordering = ["-last_activity"]
        indexes = [
            models.Index(fields=["session_key"]),
            models.Index(fields=["user_id", "is_active"]),
            models.Index(fields=["expires_at"]),
        ]
    
    def __str__(self):
        return f"Session for {self.user.email[:30]}... ({self.session_key})"
    
    @property
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return self.expires_at <= timezone.now()
    
    def extend_expiry(self, days: int = 7) -> None:
        """Extend session expiry by N days."""
        self.expires_at = timezone.now() + timedelta(days=days)
        self.save(update_fields=["expires_at", "last_activity"])
    
    def refresh_activity(self) -> None:
        """Update last_activity timestamp."""
        self.last_activity = timezone.now()
        self.save(update_fields=["last_activity"])


class SessionDevice(models.Model):
    """
    Track device information untuk setiap session.
    
    Ini memberikan visibility ke user tentang device mana
    yang punya active session mereka.
    """
    
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="devices",
        db_column="session_id",
    )
    device_name = models.CharField(max_length=255, blank=True)
    device_type = models.CharField(
        max_length=50,
        choices=[
            ("mobile", "Mobile"),
            ("tablet", "Tablet"),
            ("desktop", "Desktop"),
            ("bot", "Bot"),
            ("unknown", "Unknown"),
        ],
        default="unknown",
    )
    os_name = models.CharField(max_length=100, blank=True)
    browser_name = models.CharField(max_length=100, blank=True)
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_session_devices"
        ordering = ["-last_seen"]
        indexes = [
            models.Index(fields=["session_id", "is_current"]),
        ]
    
    def __str__(self):
        return f"{self.device_name or 'Unknown Device'} ({self.device_type})"
