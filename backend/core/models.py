from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from pgvector.django import VectorField


class UserManager(BaseUserManager):
    """Manager untuk model User custom (tanpa username, berbasis email)."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        # Superuser otomatis ber-role admin agar menu khusus admin (mis. Upload
        # Dokumen di frontend) aktif tanpa pengaturan manual tambahan.
        extra_fields.setdefault("role", self.model.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Model user — sesuai migrasi Laravel (tabel `users`)."""

    class Role(models.TextChoices):
        MAHASISWA = "mahasiswa", "Mahasiswa"
        ADMIN = "admin", "Admin"

    username = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MAHASISWA)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email


class Document(models.Model):
    """Model untuk menyimpan dokumen yang diunggah (tabel `documents`)."""

    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        INDEXED = "indexed", "Indexed"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="documents",
        db_column="user_id",
    )
    document_name = models.CharField(max_length=255)
    path_file = models.CharField(max_length=500)
    file_type = models.CharField(max_length=20)
    size = models.PositiveBigIntegerField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PROCESSING
    )
    ingest_session_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]

    def __str__(self):
        return self.document_name


class Chunk(models.Model):
    """Model untuk menyimpan potongan teks dan embedding vektornya (tabel `chunks`)."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
        db_column="document_id",
    )
    chunk_text = models.TextField()
    page = models.IntegerField(null=True, blank=True)
    # 1024 dimensi -> model 'intfloat/multilingual-e5-large'
    embedding = VectorField(dimensions=1024, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "chunks"
        indexes = [
            models.Index(fields=["document"]),
            models.Index(fields=["page"]),
        ]

    def __str__(self):
        return f"Chunk {self.id} - {self.document.document_name}"


class Query(models.Model):
    """Model query pengguna (tabel `queries`)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ANSWERED = "answered", "Answered"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="queries",
        db_column="user_id",
    )
    query_text = models.TextField()
    query_title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    current_step = models.CharField(max_length=255, null=True, blank=True)
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "queries"

    def __str__(self):
        return self.query_title


class Answer(models.Model):
    """Model jawaban (tabel `answers`)."""

    query = models.ForeignKey(
        Query,
        on_delete=models.CASCADE,
        related_name="answers",
        db_column="query_id",
    )
    answer_text = models.TextField()
    sources = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "answers"

    def __str__(self):
        return f"Answer {self.id} - {self.query.query_title}"


class History(models.Model):
    """Model riwayat (tabel `histories`)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="histories",
        db_column="user_id",
    )
    query = models.ForeignKey(
        Query,
        on_delete=models.CASCADE,
        related_name="histories",
        db_column="query_id",
    )
    answer = models.ForeignKey(
        Answer,
        on_delete=models.CASCADE,
        related_name="histories",
        db_column="answer_id",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "histories"

    def __str__(self):
        return f"History {self.id}"


class IngestLog(models.Model):
    """Model log ingest (tabel `ingest_logs`)."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="ingest_logs",
        db_column="document_id",
        null=True,
        blank=True,
    )
    session_id = models.UUIDField(null=True, blank=True)
    step = models.CharField(max_length=255)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ingest_logs"
        indexes = [
            models.Index(fields=["document", "created_at"]),
            models.Index(fields=["document", "session_id"]),
        ]

    def __str__(self):
        return f"IngestLog {self.id} - {self.step}"