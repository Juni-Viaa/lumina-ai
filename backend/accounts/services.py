"""Layanan pembuatan, pengiriman, dan validasi OTP email verifikasi."""

import logging
import secrets
from datetime import timedelta
from typing import Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from core.models import EmailVerificationCode

logger = logging.getLogger(__name__)
User = get_user_model()

OTP_EXPIRY_MINUTES = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def generate_otp_code() -> str:
    """Generate 6-digit numeric OTP securely."""
    return f"{secrets.randbelow(1_000_000):06d}"


def send_verification_otp(user: User) -> EmailVerificationCode:
    """Buat OTP baru, simpan hash-nya, dan kirim email ke user."""
    # Invalidate kode sebelumnya yang belum terpakai
    now = timezone.now()
    EmailVerificationCode.objects.filter(
        user=user,
        consumed_at__isnull=True,
    ).update(consumed_at=now)

    raw_code = generate_otp_code()
    code_hash = make_password(raw_code)
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)

    otp_record = EmailVerificationCode.objects.create(
        user=user,
        email=user.email,
        code_hash=code_hash,
        expires_at=expires_at,
    )

    context = {
        "username": user.username,
        "otp_code": raw_code,
        "valid_minutes": OTP_EXPIRY_MINUTES,
    }
    text_content = render_to_string("email/verification_code.txt", context)
    html_content = render_to_string("email/verification_code.html", context)

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@lumina.local")
    msg = EmailMultiAlternatives(
        subject="Kode Verifikasi Akun Lumina",
        body=text_content,
        from_email=from_email,
        to=[user.email],
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)

    logger.info("Verification OTP sent to %s (expires at %s)", user.email, expires_at)
    return otp_record


def check_resend_cooldown(user: User) -> Tuple[bool, int]:
    """Cek apakah user masih dalam masa cooldown resend OTP (60 detik).
    
    Returns:
        (can_resend, remaining_seconds)
    """
    latest = (
        EmailVerificationCode.objects.filter(user=user)
        .order_by("-created_at")
        .first()
    )
    if not latest:
        return True, 0

    elapsed = (timezone.now() - latest.created_at).total_seconds()
    if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
        remaining = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
        return False, remaining
    return True, 0


def verify_otp_code(email: str, code: str) -> Tuple[bool, str, Optional[User]]:
    """Verifikasi kode OTP yang dimasukkan user.
    
    Returns:
        (success, message, user)
    """
    normalized_email = email.strip().lower()
    otp_record = (
        EmailVerificationCode.objects.filter(
            email__iexact=normalized_email,
            consumed_at__isnull=True,
            deleted_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )

    if not otp_record:
        logger.warning("OTP verification failed: no active code for %s", normalized_email)
        return False, "Kode verifikasi tidak ditemukan atau sudah digunakan.", None

    if otp_record.expires_at <= timezone.now():
        logger.info("OTP verification failed: expired code for %s", normalized_email)
        return False, "Kode verifikasi sudah kadaluarsa. Silakan minta kode baru.", None

    if otp_record.attempts >= OTP_MAX_ATTEMPTS:
        logger.warning("OTP verification failed: max attempts exceeded for %s", normalized_email)
        return False, "Batas percobaan terlampaui. Silakan minta kode baru.", None

    otp_record.attempts += 1

    if not check_password(code, otp_record.code_hash):
        otp_record.save(update_fields=["attempts"])
        remaining = OTP_MAX_ATTEMPTS - otp_record.attempts
        logger.info("OTP verification failed: wrong code for %s (remaining: %d)", normalized_email, remaining)
        if remaining > 0:
            return False, f"Kode verifikasi salah. Sisa percobaan: {remaining}.", None
        return False, "Batas percobaan terlampaui. Silakan minta kode baru.", None

    # Sukses
    now = timezone.now()
    otp_record.consumed_at = now
    otp_record.save(update_fields=["consumed_at", "attempts"])

    user = otp_record.user
    user.email_verified_at = now
    user.is_active = True
    user.save(update_fields=["email_verified_at", "is_active", "updated_at"])

    logger.info("User %s email verified successfully via OTP", user.email)
    return True, "Email berhasil diverifikasi.", user
