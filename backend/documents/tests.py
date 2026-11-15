from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import User, Document, Chunk


class DocumentVisualActionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="password123",
            role="mahasiswa",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="otheruser@example.com",
            password="password123",
            role="mahasiswa",
        )
        self.doc = Document.objects.create(
            user=self.user,
            document_name="sample.pdf",
            path_file="/tmp/sample.pdf",
            file_type="pdf",
            size=1024,
            status=Document.Status.INDEXED,
        )

    def test_visual_action_returns_grouped_results(self):
        self.client.force_authenticate(user=self.user)

        # Chunks for image-1
        Chunk.objects.create(
            document=self.doc,
            chunk_text="OCR text for image 1",
            metadata={"source_type": "ocr", "image_ref": "page-1-image-1", "ocr_confidence": 0.95},
        )
        Chunk.objects.create(
            document=self.doc,
            chunk_text="Vision text for image 1",
            metadata={"source_type": "vision", "image_ref": "page-1-image-1"},
        )
        # Regular text chunk (should be ignored by visual)
        Chunk.objects.create(
            document=self.doc,
            chunk_text="Regular document paragraph",
            metadata={"source_type": "document_text"},
        )

        response = self.client.get(f"/api/documents/{self.doc.id}/visual/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        group = data[0]
        self.assertEqual(group["imageRef"], "page-1-image-1")
        self.assertEqual(len(group["ocr"]), 1)
        self.assertEqual(group["ocr"][0]["chunk_text"], "OCR text for image 1")
        self.assertEqual(group["ocr"][0]["metadata"]["ocr_confidence"], 0.95)
        self.assertEqual(len(group["vision"]), 1)
        self.assertEqual(group["vision"][0]["chunk_text"], "Vision text for image 1")

    def test_visual_action_returns_empty_when_no_visual_chunks(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/documents/{self.doc.id}/visual/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_visual_action_404_for_missing_or_unauthorized_document(self):
        # 404 for non-existent document
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/documents/999999/visual/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 404 for document belonging to another user
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(f"/api/documents/{self.doc.id}/visual/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
