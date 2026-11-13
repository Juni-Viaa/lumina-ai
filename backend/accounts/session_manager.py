"""
Session manager untuk mengelola authentication sessions.
Menggantikan TokenAuthentication untuk web client dengan HttpOnly cookie.
"""
import logging
from typing import Optional, Tuple

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Session, SessionDevice

logger = logging.getLogger(__name__)
User = get_user_model()


def get_device_info(request) -> dict:
    """
    Extract device information dari HTTP request.
    
    Returns dict dengan:
    - user_agent: User-Agent string
    - ip_address: Client IP address
    - device_type: mobile/tablet/desktop/bot/unknown
    """
    user_agent = request.META.get("HTTP_USER_AGENT", "") or ""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.META.get("REMOTE_ADDR", "")
    
    # Simple device detection dari User-Agent
    ua_lower = user_agent.lower()
    if any(device in ua_lower for device in ["mobile", "android", "iphone", "ipad"]):
        device_type = "mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        device_type = "tablet"
    elif any(bot in ua_lower for bot in ["bot", "crawler", "spider", "scraper"]):
        device_type = "bot"
    elif ua_lower:
        device_type = "desktop"
    else:
        device_type = "unknown"
    
    return {
        "user_agent": user_agent[:500],  # Limit length
        "ip_address": ip_address[:45],   # IPv6 max length
        "device_type": device_type,
    }


def create_session(
    user_id: int,
    request=None,
    device_name: str = None,
    expiry_days: int = 7,
) -> Session:
    """
    Create new session untuk user.
    
    Args:
        user_id: User ID
        request: HttpRequest (optional, untuk extract device info)
        device_name: Optional device name untuk display
        expiry_days: Session expiry dalam hari (default: 7)
    
    Returns:
        Session object yang newly created
    """
    device_info = get_device_info(request) if request else {}
    
    session = Session.objects.create(
        user_id=user_id,
        user_agent=device_info.get("user_agent", ""),
        ip_address=device_info.get("ip_address", None),
        expires_at=timezone.now() + timezone.timedelta(days=expiry_days),
    )
    
    # Create device record jika request tersedia
    if request and device_info.get("user_agent"):
        try:
            SessionDevice.objects.create(
                session=session,
                device_name=device_name or extract_device_name(device_info.get("user_agent", "")),
                device_type=device_info.get("device_type", "unknown"),
                os_name=extract_os_name(device_info.get("user_agent", "")),
                browser_name=extract_browser_name(device_info.get("user_agent", "")),
                is_current=True,
            )
        except Exception as e:
            logger.warning(f"Failed to create session device: {e}")
    
    logger.info(f"Created session {session.session_key} for user {user_id}")
    return session


def extract_device_name(user_agent: str) -> str:
    """Extract device name dari user agent string."""
    if "iPhone" in user_agent:
        return "iPhone"
    elif "iPad" in user_agent:
        return "iPad"
    elif "Android" in user_agent:
        return "Android Device"
    elif "Macintosh" in user_agent:
        return "Mac"
    elif "Windows" in user_agent:
        return "Windows"
    elif "Linux" in user_agent:
        return "Linux"
    else:
        return "Unknown Device"


def extract_os_name(user_agent: str) -> str:
    """Extract OS name dari user agent string."""
    if "Windows" in user_agent:
        return "Windows"
    elif "Macintosh" in user_agent or "Mac OS" in user_agent:
        return "macOS"
    elif "Linux" in user_agent:
        return "Linux"
    elif "iPhone" in user_agent or "iPad" in user_agent:
        return "iOS"
    elif "Android" in user_agent:
        return "Android"
    else:
        return "Unknown"


def extract_browser_name(user_agent: str) -> str:
    """Extract browser name dari user agent string."""
    if "Chrome" in user_agent and "Edg" not in user_agent and "OPR" not in user_agent:
        return "Chrome"
    elif "Edg" in user_agent:
        return "Edge"
    elif "Firefox" in user_agent:
        return "Firefox"
    elif "Safari" in user_agent and "Chrome" not in user_agent:
        return "Safari"
    elif "OPR" in user_agent:
        return "Opera"
    else:
        return "Unknown"


def validate_session(session_key_or_obj) -> Tuple[Optional[Session], bool]:
    """
    Validate session key dan return session jika valid.
    
    Args:
        session_key_or_obj: Session object atau UUID session_key
    
    Returns:
        Tuple of (session, is_valid)
    """
    try:
        if isinstance(session_key_or_obj, Session):
            session = session_key_or_obj
        else:
            session = Session.objects.get(session_key=session_key_or_obj)
        
        if not session.is_active:
            return None, False
        
        if session.is_expired:
            session.is_active = False
            session.save(update_fields=["is_active"])
            return None, False
        
        # Refresh last activity
        session.refresh_activity()
        return session, True
    
    except (Session.DoesNotExist, ValidationError, ValueError):
        return None, False


def get_session_by_key(session_key) -> Optional[Session]:
    """Get session by session_key, return None jika tidak ada."""
    try:
        session = Session.objects.get(session_key=session_key)
        if session.is_active and not session.is_expired:
            session.refresh_activity()
            return session
        return None
    except (Session.DoesNotExist, ValidationError, ValueError):
        return None


def get_active_session_for_user(user_id: int) -> Optional[Session]:
    """Get latest active session untuk user."""
    try:
        session = Session.objects.filter(
            user_id=user_id,
            is_active=True,
        ).order_by("-last_activity").first()
        
        if session and not session.is_expired:
            session.refresh_activity()
            return session
        return None
    except Session.DoesNotExist:
        return None


def revoke_session(session_key) -> bool:
    """
    Revoke single session.
    
    Args:
        session_key: UUID dari session
    
    Returns:
        True jika berhasil, False jika tidak ditemukan
    """
    try:
        session = Session.objects.get(session_key=session_key)
        session.is_active = False
        session.save(update_fields=["is_active"])
        
        # Mark all devices as not current
        SessionDevice.objects.filter(session=session).update(is_current=False)
        
        logger.info(f"Revoked session {session_key}")
        return True
    except (Session.DoesNotExist, ValidationError, ValueError):
        return False


def revoke_all_sessions(user_id: int, exclude_session_key=None) -> int:
    """
    Revoke semua session untuk user, kecuali jika exclude_session_key.
    
    Args:
        user_id: User ID
        exclude_session_key: UUID session yang tidak di-revoke (opsional)
    
    Returns:
        Jumlah session yang di-revoke
    """
    queryset = Session.objects.filter(user_id=user_id, is_active=True)
    
    if exclude_session_key:
        queryset = queryset.exclude(session_key=exclude_session_key)
    
    count = queryset.update(is_active=False)
    
    # Mark devices as not current
    if exclude_session_key:
        SessionDevice.objects.filter(
            session__user_id=user_id,
            session__is_active=False,
        ).exclude(
            session__session_key=exclude_session_key
        ).update(is_current=False)
    else:
        SessionDevice.objects.filter(
            session__user_id=user_id,
            session__is_active=False,
        ).update(is_current=False)
    
    logger.info(f"Revoked {count} sessions for user {user_id}")
    return count


def get_user_sessions(user_id: int, active_only: bool = True):
    """
    Get list of sessions untuk user.
    
    Args:
        user_id: User ID
        active_only: Jika True, hanya return active sessions
    
    Returns:
        QuerySet of Session objects
    """
    queryset = Session.objects.filter(user_id=user_id).order_by("-last_activity")
    
    if active_only:
        queryset = queryset.filter(is_active=True)
    
    return queryset.select_related("user")


def cleanup_expired_sessions() -> int:
    """
    Cleanup expired sessions (run via Celery beat).
    
    Returns:
        Jumlah session yang di-deactivate
    """
    expired = Session.objects.filter(
        is_active=True,
        expires_at__lt=timezone.now(),
    )
    
    count = expired.update(is_active=False)
    
    # Mark devices as not current
    SessionDevice.objects.filter(
        session__is_active=False,
    ).update(is_current=False)
    
    logger.info(f"Cleaned up {count} expired sessions")
    return count
