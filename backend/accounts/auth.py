"""
Custom authentication class untuk HttpOnly Cookie authentication.
Menggantikan TokenAuthentication untuk web client.
"""
import logging
from typing import Optional, Tuple

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import Session
from .session_manager import get_session_by_key, validate_session

logger = logging.getLogger(__name__)
User = get_user_model()


class CookieSessionAuthentication(BaseAuthentication):
    """
    DRF Authentication class menggunakan HttpOnly cookie.
    
    Authentication flow:
    1. Baca session key dari cookie `lumina_session`
    2. Validate session di database
    3. Return (user, session) tuple jika valid
    4. Raise AuthenticationFailed jika invalid/expired
    
    Fallback:
    - Jika cookie tidak ada, coba header Authorization (Token authentication)
    - Ini support hybrid auth (web cookie + mobile API token)
    """
    
    cookie_name = "lumina_session"
    
    def authenticate(self, request) -> Optional[Tuple[User, Session]]:
        """
        Authenticate user menggunakan cookie session.
        
        Args:
            request: DRF Request object
        
        Returns:
            Tuple (user, session) jika auth success
            None jika auth tidak required (anonym access)
        
        Raises:
            AuthenticationFailed jika session invalid
        """
        # Cek cookie terlebih dahulu (primary untuk web)
        session_key = request.COOKIES.get(self.cookie_name)
        
        if session_key:
            session = get_session_by_key(session_key)
            if session:
                return (session.user, session)
            else:
                raise AuthenticationFailed("Session tidak valid atau sudah expired.")
        
        # Fallback ke Token authentication (untuk mobile/API clients)
        # Ini hanya jika client set header Authorization: Token <token>
        token_auth = self._try_token_auth(request)
        if token_auth:
            return token_auth
        
        return None
    
    def _try_token_auth(self, request) -> Optional[Tuple[User, Session]]:
        """
        Try authenticate dengan Token authentication (fallback).
        
        Ini untuk support mobile/API clients yang tidak bisa pakai cookie.
        """
        from rest_framework.authtoken.models import Token
        
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Token "):
            return None
        
        token_key = auth_header[6:]  # Remove "Token " prefix
        
        try:
            token = Token.objects.get(key=token_key)
            user = token.user
            
            # Create session untuk user ini juga (support hybrid mode)
            # Ini akan create session baru setiap API call dari mobile
            # Untuk production, mungkin perlu caching
            session = Session.objects.create(
                user=user,
                user_agent="mobile-api",
                ip_address=request.META.get("REMOTE_ADDR", ""),
                expires_at=timezone.now() + timezone.timedelta(days=7),
            )
            
            return (user, session)
        
        except Token.DoesNotExist:
            return None
    
    def authenticate_header(self, request) -> str:
        """
        Return WWW-Authenticate header untuk 401 response.
        
        This is used by DRF to determine the auth scheme.
        """
        return 'Token realm="api"'


class CSRFExemptSessionAuthentication(CookieSessionAuthentication):
    """
    Cookie authentication tanpa CSRF validation.
    
    Gunakan ini untuk API endpoints yang menggunakan AJAX/Fetch
    dengan CSRF token di header (bukan cookie).
    """
    
    def authenticate(self, request):
        result = super().authenticate(request)
        
        # Set CSRF token di response header untuk frontend
        if result:
            from django.middleware.csrf import get_token
            # Django akan set cookie CSRF secara otomatis di middleware
            # Kita tidak perlu set manual di header
        
        return result
