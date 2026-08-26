import logging

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Query, Answer, History
from ingest.retrieval import run_rag_query
from .serializers import QuerySerializer, AnswerSerializer, HistorySerializer

logger = logging.getLogger(__name__)


def _make_title(question: str) -> str:
    """Buat judul query dari 8 kata pertama pertanyaan."""
    words = question.split()
    title = " ".join(words[:8])
    return f"{title}…" if len(title) < len(question) else title


class AskView(APIView):
    """
    POST /api/ask/
    Menerima pertanyaan, membuat baris Query, lalu menjalankan pipeline RAG
    (pgvector similarity search + generasi jawaban Gemini) dan menyimpan jawaban.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response(
                {"detail": "question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(question) < 2 or len(question) > 2000:
            return Response(
                {"detail": "question harus antara 2 dan 2000 karakter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Persist query row
        query = Query.objects.create(
            user=request.user,
            query_text=question,
            query_title=_make_title(question),
            status=Query.Status.PENDING,
        )

        # 2. Run RAG pipeline
        try:
            result = run_rag_query(query.id, question)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:  # noqa: BLE001
            logger.exception("RAG query failed")
            query.status = Query.Status.FAILED
            query.current_step = "error"
            query.save(update_fields=["status", "current_step", "updated_at"])
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class QueryViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD query pengguna."""

    queryset = Query.objects.all()
    serializer_class = QuerySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter query berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return Query.objects.all()
        return Query.objects.filter(user=user)

    def perform_create(self, serializer):
        """Set user_id otomatis dari user yang sedang login."""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def answers(self, request, pk=None):
        """Mengembalikan jawaban untuk query tertentu."""
        query = self.get_object()
        answers = Answer.objects.filter(query=query)
        serializer = AnswerSerializer(answers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def ask(self, request, pk=None):
        """
        POST /api/queries/{id}/ask/
        Runs the RAG pipeline (pgvector similarity search + Gemini) for this
        query and returns the generated answer with sources.
        """
        query = self.get_object()
        question = (request.data.get("question") or query.query_text).strip()
        if not question:
            return Response(
                {"detail": "question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = run_rag_query(query.id, question)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:  # noqa: BLE001
            logger.exception("RAG query failed")
            query.status = Query.Status.FAILED
            query.current_step = "error"
            query.save(update_fields=["status", "current_step", "updated_at"])
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AnswerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk jawaban."""

    queryset = Answer.objects.all()
    serializer_class = AnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter jawaban berdasarkan query milik user."""
        user = self.request.user
        if user.role == "admin":
            return Answer.objects.all()
        return Answer.objects.filter(query__user=user)


class HistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk riwayat chat."""

    queryset = History.objects.all()
    serializer_class = HistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter riwayat berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return History.objects.all()
        return History.objects.filter(user=user).order_by("-query__created_at")