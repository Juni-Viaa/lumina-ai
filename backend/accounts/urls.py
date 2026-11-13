"""URL routing untuk endpoint autentikasi Lumina."""

from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("me/", views.MeView.as_view(), name="me"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("sessions/", views.SessionListView.as_view(), name="session-list"),
    path("sessions/<str:session_key>/", views.SessionRevokeView.as_view(), name="session-revoke"),
    path("sessions/revoke-all/", views.SessionRevokeAllView.as_view(), name="session-revoke-all"),
    path("csrf/", views.CsrfTokenView.as_view(), name="csrf"),
]