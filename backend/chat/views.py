import logging

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Query, Answer, History
from ingest.retrieval import RagPipelineError, run_rag_query
from .serializers import QuerySerializer, AnswerSerializer, HistorySerializer

logger = logging.getLogger(__name__)

GENERIC_ASK_ERROR = "Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi."


def _make_title(question: str) -> str:
    """Buat judul query dari 8 kata pertama pertanyaan."""
    words = question.split()
    title = " ".join(words[:8])
    return f"{title}…" if len(title) < len(question) else title


def _mark_query_failed_and_log(query: Query) -> None:
    """Tandai query gagal dan pastikan tetap tercatat di riwayat (history).

    Riwayat dibuat tanpa jawaban (answer=null) agar user tetap melihat
    pertanyaannya di halaman history dengan badge "Gagal".
    """
    if query.pk is not None:
        query.status = Query.Status.FAILED
        query.current_step = "error"
        query.save(update_fields=["status", "current_step", "updated_at"])
    History.objects.get_or_create(user=query.user, query=query)


def _execute_ask(query: Query, question: str) -> Response:
    """Jalankan pipeline RAG untuk `query`, lalu kembalikan response DRF."""
    try:
        result = run_rag_query(query.id, question)
        return Response(result, status=status.HTTP_200_OK)
    except RagPipelineError as exc:
        logger.warning(
            "RAG pipeline error on query %s (http %s): %s",
            query.id,
            exc.http_status,
            exc,
        )
        _mark_query_failed_and_log(query)
        return Response({"detail": exc.user_message}, status=exc.http_status)
    except Exception:  # noqa: BLE001
        logger.exception("RAG query failed")
        _mark_query_failed_and_log(query)
        return Response(
            {"detail": GENERIC_ASK_ERROR},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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
        return _execute_ask(query, question)


class QueryViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD query pengguna."""

    queryset = Query.objects.all()
    serializer_class = QuerySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter query berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return Query.objects.filter(deleted_at__isnull=True)
        return Query.objects.filter(user=user, deleted_at__isnull=True)

    def perform_create(self, serializer):
        """Set user_id otomatis dari user yang sedang login."""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def answers(self, request, pk=None):
        """Mengembalikan jawaban untuk query tertentu."""
        query = self.get_object()
        answers = Answer.objects.filter(query=query, deleted_at__isnull=True)
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
        return _execute_ask(query, question)


class AnswerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk jawaban."""

    queryset = Answer.objects.all()
    serializer_class = AnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter jawaban berdasarkan query milik user."""
        user = self.request.user
        if user.role == "admin":
            return Answer.objects.filter(deleted_at__isnull=True).select_related("query")
        return Answer.objects.filter(query__user=user, deleted_at__isnull=True).select_related("query")


class HistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet read-only untuk riwayat chat."""

    queryset = History.objects.all()
    serializer_class = HistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter riwayat berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return History.objects.select_related("query", "answer", "user").order_by("-id")
        return History.objects.filter(user=user).select_related("query", "answer", "user").order_by("-id")
