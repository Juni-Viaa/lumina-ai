"""Serializers untuk endpoint autentikasi Lumina (session-based)."""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Data user publik untuk respons login/register/me."""

    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "is_staff", "created_at"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """Validasi & pembuatan user baru."""

    username = serializers.CharField(max_length=255, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email sudah terdaftar.")
        return value

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username sudah digunakan.")
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Konfirmasi password tidak cocok."}
            )
        validate_password(attrs["password"], user=User(username=attrs["username"], email=attrs["email"]))
        return attrs

    def create(self, validated_data: dict) -> User:
        validated_data.pop("password_confirm")
        return User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    """Validasi kredensial login."""

    email = serializers.CharField(trim_whitespace=True)
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs: dict) -> dict:
        identifier = (attrs.get("email") or "").strip()
        password = attrs.get("password") or ""

        target_user = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()

        username_to_auth = target_user.email if target_user else identifier
        user = authenticate(username=username_to_auth, password=password)
        if user is None:
            raise serializers.ValidationError("Email atau password salah.")
        if not user.is_active:
            raise serializers.ValidationError("Akun Anda dinonaktifkan.")
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """Validasi ganti password untuk user yang sudah login."""

    old_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs: dict) -> dict:
        user = self.context["request"].user
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"old_password": "Password lama salah."})
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Konfirmasi password tidak cocok."}
            )
        if attrs["new_password"] == attrs["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "Password baru harus berbeda dari password lama."}
            )
        validate_password(attrs["new_password"], user=user)
        return attrs


class SessionDeviceSerializer(serializers.Serializer):
    """Session device info."""

    device_name = serializers.CharField(max_length=255, required=False)
    device_type = serializers.CharField(max_length=50, required=False)
    os_name = serializers.CharField(max_length=100, required=False)
    browser_name = serializers.CharField(max_length=100, required=False)
    is_current = serializers.BooleanField()


class SessionSerializer(serializers.Serializer):
    """Session data untuk list/revoke endpoints."""

    session_key = serializers.UUIDField(format="hex")
    created_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    last_activity = serializers.DateTimeField()
    is_active = serializers.BooleanField()
    is_expired = serializers.SerializerMethodField()
    device_info = SessionDeviceSerializer(required=False, many=True)

    def get_is_expired(self, obj) -> bool:
        """Calculate if session is expired."""
        return obj.expires_at <= timezone.now()
