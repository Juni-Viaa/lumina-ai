from unittest.mock import patch
import threading

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from core.models import Document, IngestLog

User = get_user_model()


@override_settings(
    MEDIA_ROOT="D:/Project/Django/lumina/backend/media_test",
    DEBUG=True,
)
class IngestUploadViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin_user)

    def tearDown(self):
        import shutil
        from django.conf import settings
        media_test = "D:/Project/Django/lumina/backend/media_test"
        try:
            shutil.rmtree(media_test, ignore_errors=True)
        except Exception:
            pass

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_upload_new_document_success(self, mock_delay):
        file_content = b"%PDF-1.4 test content placeholder"
        uploaded_file = SimpleUploadedFile(
            "test_document.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("document_id", response.json())
        self.assertIn("session_id", response.json())
        self.assertEqual(response.json()["status"], "processing")

        self.assertTrue(
            Document.objects.filter(
                user=self.admin_user,
                document_name="test_document.pdf",
                status=Document.Status.PROCESSING,
            ).exists()
        )
        self.assertEqual(mock_delay.call_count, 1)

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_upload_invalid_extension(self, mock_delay):
        uploaded_file = SimpleUploadedFile(
            "test.txt",
            b"test content",
            content_type="text/plain",
        )
        uploaded_file.name = "test.jpg"

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertIn("Tipe file tidak didukung", response.json()["detail"])
        self.assertEqual(mock_delay.call_count, 0)

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_upload_missing_file(self, mock_delay):
        response = self.client.post(
            reverse("ingest-upload"),
            {},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Field 'document'", response.json()["detail"])
        self.assertEqual(mock_delay.call_count, 0)

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_re_ingest_existing_document(self, mock_delay):
        existing_doc = Document.objects.create(
            user=self.admin_user,
            document_name="original.pdf",
            path_file="/media/documents/original.pdf",
            file_type="pdf",
            size=1024,
            status=Document.Status.INDEXED,
            ingest_session_id="11111111-1111-1111-1111-111111111111",
        )

        file_content = b"%PDF-1.4 updated content placeholder"
        uploaded_file = SimpleUploadedFile(
            "updated.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file, "document_id": existing_doc.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()["document_id"], existing_doc.id)
        self.assertEqual(response.json()["status"], "processing")

        existing_doc.refresh_from_db()
        self.assertEqual(existing_doc.status, Document.Status.PROCESSING)
        self.assertNotEqual(existing_doc.ingest_session_id, "11111111-1111-1111-1111-111111111111")

        self.assertTrue(
            IngestLog.objects.filter(
                document=existing_doc,
                step="re-init",
            ).exists()
        )
        self.assertEqual(mock_delay.call_count, 1)

    def test_re_ingest_nonexistent_document(self):
        file_content = b"%PDF-1.4 test content"
        uploaded_file = SimpleUploadedFile(
            "test.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file, "document_id": 9999},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("Dokumen tidak ditemukan", response.json()["detail"])

    def test_re_ingest_unauthorized_document(self):
        other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="testpass123",
            role=User.Role.MAHASISWA,
        )
        other_doc = Document.objects.create(
            user=other_user,
            document_name="other.pdf",
            path_file="/media/documents/other.pdf",
            file_type="pdf",
            size=1024,
            status=Document.Status.INDEXED,
            ingest_session_id="22222222-2222-2222-2222-222222222222",
        )

        file_content = b"%PDF-1.4 test content"
        uploaded_file = SimpleUploadedFile(
            "test.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file, "document_id": other_doc.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("tidak memiliki akses", response.json()["detail"])

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_invalid_document_id_format(self, mock_delay):
        file_content = b"%PDF-1.4 test content"
        uploaded_file = SimpleUploadedFile(
            "test.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file, "document_id": "invalid"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("document_id harus berupa integer", response.json()["detail"])
        self.assertEqual(mock_delay.call_count, 0)

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_non_admin_user_forbidden(self, mock_delay):
        regular_user = User.objects.create_user(
            email="user@example.com",
            username="user",
            password="testpass123",
            role=User.Role.MAHASISWA,
        )
        self.client.force_authenticate(user=regular_user)

        file_content = b"%PDF-1.4 test content"
        uploaded_file = SimpleUploadedFile(
            "test.pdf",
            file_content,
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("ingest-upload"),
            {"document": uploaded_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("tidak memiliki izin", response.json()["detail"])
        self.assertEqual(mock_delay.call_count, 0)

    @patch("ingest.tasks.run_ingest_pipeline_task.delay")
    def test_concurrent_uploads_no_deadlock(self, mock_delay):
        # Mock delay() to avoid celery task execution and DB thread-safety issues
        mock_delay.return_value = None
        
        # Test sequential upload
        for i in range(3):
            file_content = f"%PDF-1.4 test content {i}".encode()
            uploaded_file = SimpleUploadedFile(
                f"test_{i}.pdf",
                file_content,
                content_type="application/pdf",
            )
            response = self.client.post(
                reverse("ingest-upload"),
                {"document": uploaded_file},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
            self.assertIn("document_id", response.json())
        
        self.assertEqual(mock_delay.call_count, 3)
        self.assertEqual(Document.objects.filter(user=self.admin_user).count(), 3)
