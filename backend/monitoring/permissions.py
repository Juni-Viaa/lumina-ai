"""
permissions.py — Pembatasan akses khusus administrator untuk fitur monitoring.
"""

from rest_framework import permissions


class IsAdminUserRole(permissions.BasePermission):
    """
    Hanya mengizinkan akses bagi pengguna dengan peran 'admin' atau berstatus staff.
    """

    message = "Akses ditolak. Fitur monitoring hanya dapat diakses oleh administrator."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (getattr(user, "role", None) == "admin" or getattr(user, "is_staff", False))
        )
