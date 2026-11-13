"""Views API autentikasi Lumina (HttpOnly Cookie + Token fallback)."""

import logging

from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth import CookieSessionAuthentication
from .models import Session
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    SessionSerializer,
    UserSerializer,
)
from .session_manager import (
    create_session,
    get_user_sessions,
    revoke_all_sessions,
    revoke_session,
)

logger = logging.getLogger(__name__)

COOKIE_NAME = "lumina_session"


def _set_session_cookie(response: Response, session: Session) -> None:
    """Set HttpOnly session cookie pada response."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=str(session.session_key),
        max_age=settings.SESSION_COOKIE_AGE,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
    )


def _delete_session_cookie(response: Response) -> None:
    """Hapus session cookie dari response."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )


class RegisterView(APIView):
    """POST /api/auth/register/ — buat akun baru, set session cookie."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        session = create_session(user.id, request=request)

        response = Response(
            {"user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        _set_session_cookie(response, session)

        # Set CSRF token
        get_token(request)

        return response


class LoginView(APIView):
    """POST /api/auth/login/ — email + password -> session cookie + user profile."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        session = create_session(user.id, request=request)

        response = Response({"user": UserSerializer(user).data})
        _set_session_cookie(response, session)

        # Set CSRF token so frontend can read it for subsequent requests
        get_token(request)

        return response


class MeView(APIView):
    """GET /api/auth/me/ — profil user yang sedang login via cookie."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session: Session = request.auth

        data = UserSerializer(request.user).data

        # Include session expiry info
        if session:
            data["session_expires_at"] = session.expires_at.isoformat()

        return Response(data)


class LogoutView(APIView):
    """POST /api/auth/logout/ — revoke session, hapus cookie."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_key = request.COOKIES.get(COOKIE_NAME)

        if session_key:
            revoke_session(session_key)

        response = Response({"detail": "Berhasil keluar."})
        _delete_session_cookie(response)
        return response


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/ — ganti password, revoke semua session."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password", "updated_at"])

        # Revoke semua session agar harus login ulang di semua device
        revoke_all_sessions(request.user.id)

        response = Response({"detail": "Password berhasil diubah. Silakan login kembali."})
        _delete_session_cookie(response)
        return response


class SessionListView(APIView):
    """GET /api/auth/sessions/ — list active sessions user."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = get_user_sessions(request.user.id, active_only=True)
        current_session_key = str(request.auth.session_key) if request.auth else None

        data = SessionSerializer(
            sessions,
            many=True,
            context={"current_session_key": current_session_key},
        ).data

        return Response({"sessions": data, "count": len(data)})


class SessionRevokeView(APIView):
    """DELETE /api/auth/sessions/{session_key}/ — revoke specific session."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, session_key: str):
        try:
            session = Session.objects.get(
                session_key=session_key,
                user=request.user,
                is_active=True,
            )
        except Session.DoesNotExist:
            return Response(
                {"detail": "Session tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_current = str(request.auth.session_key) == session_key if request.auth else False
        revoke_session(session_key)

        response = Response({"detail": "Session berhasil diakhiri."})

        # Jika user me-revoke session mereka sendiri, delete cookie juga
        if is_current:
            _delete_session_cookie(response)

        return response


class SessionRevokeAllView(APIView):
    """POST /api/auth/sessions/revoke-all/ — revoke semua session kecuali current."""

    authentication_classes = [CookieSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_session_key = request.auth.session_key if request.auth else None
        count = revoke_all_sessions(
            request.user.id,
            exclude_session_key=current_session_key,
        )
        return Response({"detail": f"{count} session berhasil diakhiri.", "count": count})


class CsrfTokenView(APIView):
    """GET /api/auth/csrf/ — get CSRF token untuk frontend."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        csrf_token = get_token(request)
        return Response({"csrf_token": csrf_token})
