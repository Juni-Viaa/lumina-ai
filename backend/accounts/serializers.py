"""Serializers untuk endpoint autentikasi Lumina (session-based)."""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .services import check_resend_cooldown, send_verification_otp, verify_otp_code

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Data user publik untuk respons login/register/me."""

    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "is_staff", "created_at"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """Validasi & pembuatan user baru (inaktif sebelum OTP)."""

    username = serializers.CharField(max_length=15, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        target = User.objects.filter(email__iexact=value).first()
        if target:
            if not target.email_verified_at:
                raise serializers.ValidationError(
                    "Email sudah terdaftar tetapi belum diverifikasi. Silakan masukkan kode OTP atau minta kirim ulang."
                )
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
        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            password=validated_data["password"],
            is_active=False,
        )
        send_verification_otp(user)
        return user


class VerifyEmailSerializer(serializers.Serializer):
    """Validasi verifikasi kode OTP email."""

    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6, trim_whitespace=True)

    def validate_otp(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError("Kode OTP harus berupa 6 angka.")
        return value

    def validate(self, attrs: dict) -> dict:
        success, message, user = verify_otp_code(attrs["email"], attrs["otp"])
        if not success:
            raise serializers.ValidationError({"otp": message})
        attrs["user"] = user
        return attrs


class ResendOtpSerializer(serializers.Serializer):
    """Validasi pengiriman ulang kode OTP."""

    email = serializers.EmailField()

    def validate(self, attrs: dict) -> dict:
        email = attrs["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        attrs["user"] = user
        if user:
            if user.email_verified_at:
                raise serializers.ValidationError(
                    {"email": "Email ini sudah terverifikasi. Silakan login."}
                )
            can_resend, remaining = check_resend_cooldown(user)
            if not can_resend:
                raise serializers.ValidationError(
                    {"email": f"Mohon tunggu {remaining} detik sebelum meminta kode baru."}
                )
        return attrs


class LoginSerializer(serializers.Serializer):
    """Validasi kredensial login."""

    email = serializers.CharField(trim_whitespace=True)
    password = serializers.CharField(trim_whitespace=False)
    remember_me = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs: dict) -> dict:
        identifier = (attrs.get("email") or "").strip()
        password = attrs.get("password") or ""

        target_user = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()

        username_to_auth = target_user.email if target_user else identifier
        user = authenticate(username=username_to_auth, password=password)
        if user is None:
            if target_user and target_user.check_password(password) and not target_user.email_verified_at:
                raise serializers.ValidationError(
                    "Email belum diverifikasi. Silakan masukkan kode OTP yang telah dikirim ke email Anda."
                )
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
