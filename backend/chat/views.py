import json
import logging

from django.db.models import Q, Prefetch
from django.http import StreamingHttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Query, Answer, History, Conversation
from core.renderers import ServerSentEventRenderer
from rest_framework.renderers import JSONRenderer
from ingest.retrieval import RagPipelineError, run_rag_query, stream_rag_query
from monitoring.services import check_request_limits, estimate_tokens, record_request_log
from .serializers import QuerySerializer, AnswerSerializer, HistorySerializer, ConversationSerializer, ConversationListSerializer

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
    History.objects.get_or_create(user=query.user, conversation=query.conversation, query=query)


def _mark_query_stopped_and_log(query: Query) -> None:
    """Tandai query dihentikan dan pastikan tetap tercatat di riwayat (history)."""
    if query.pk is not None:
        query.refresh_from_db(fields=["status"])
        if query.status == Query.Status.PENDING:
            query.status = Query.Status.STOPPED
            query.current_step = "stopped"
            query.save(update_fields=["status", "current_step", "updated_at"])
    History.objects.get_or_create(user=query.user, conversation=query.conversation, query=query)


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
                {"detail": "Pertanyaan wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(question) < 2 or len(question) > 2000:
            return Response(
                {"detail": "Pertanyaan harus antara 2 dan 2000 karakter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rate limiting & token quota check
        est_tokens = estimate_tokens(question)
        allowed, err_msg, status_code, retry_after = check_request_limits(
            request.user, estimated_input_tokens=est_tokens
        )
        if not allowed:
            record_request_log(
                user=request.user,
                endpoint=request.path,
                input_tokens=est_tokens,
                status_code=status_code,
                error_message=err_msg,
            )
            response = Response({"detail": err_msg}, status=status_code)
            if retry_after > 0:
                response["Retry-After"] = str(retry_after)
            return response

        # 1. Get conversation_id from request (if provided) or create a new conversation
        conversation_id = request.data.get("conversation_id")
        
        if conversation_id:
            try:
                # Admin juga hanya dapat mengakses conversation milik dirinya sendiri.
                conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            except Conversation.DoesNotExist:
                return Response(
                    {"detail": "Percakapan tidak ditemukan atau Anda tidak memiliki akses."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            conversation = Conversation.objects.create(
                user=request.user,
                title=_make_title(question)
            )

        # 2. Persist query row
        query = Query.objects.create(
            user=request.user,
            conversation=conversation,
            query_text=question,
            query_title=_make_title(question),
            status=Query.Status.PENDING,
        )

        # 3. Run RAG pipeline
        result = _execute_ask(query, question)
        
        # 4. Add conversation_id to all responses
        if isinstance(result.data, dict):
            result.data["conversation_id"] = conversation.id
        
        return result


class AskStreamView(APIView):
    """
    POST /api/ask/stream/
    Menerima pertanyaan dan mengembalikan Server-Sent Events (SSE) dengan
    tahapan progres RAG (embedding, retrieval, reranking, generating),
    streaming token teks jawaban, dan sumber referensi akhir.
    """

    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [ServerSentEventRenderer, JSONRenderer]

    def post(self, request, *args, **kwargs):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response(
                {"detail": "Pertanyaan wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(question) < 2 or len(question) > 2000:
            return Response(
                {"detail": "Pertanyaan harus antara 2 dan 2000 karakter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rate limiting & token quota check
        est_tokens = estimate_tokens(question)
        allowed, err_msg, status_code, retry_after = check_request_limits(
            request.user, estimated_input_tokens=est_tokens
        )
        if not allowed:
            record_request_log(
                user=request.user,
                endpoint=request.path,
                input_tokens=est_tokens,
                status_code=status_code,
                error_message=err_msg,
            )
            response = Response({"detail": err_msg}, status=status_code)
            if retry_after > 0:
                response["Retry-After"] = str(retry_after)
            return response

        conversation_id = request.data.get("conversation_id")
        if conversation_id:
            try:
                # Admin juga hanya dapat mengakses conversation milik dirinya sendiri.
                conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            except Conversation.DoesNotExist:
                return Response(
                    {"detail": "Percakapan tidak ditemukan atau Anda tidak memiliki akses."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            conversation = Conversation.objects.create(
                user=request.user,
                title=_make_title(question),
            )

        query = Query.objects.create(
            user=request.user,
            conversation=conversation,
            query_text=question,
            query_title=_make_title(question),
            status=Query.Status.PENDING,
        )

        def event_stream():
            try:
                yield f"data: {json.dumps({'type': 'init', 'query_id': query.id, 'conversation_id': conversation.id})}\n\n"
                for event in stream_rag_query(query.id, question):
                    if event.get("type") == "done" and "data" in event:
                        event["data"]["conversation_id"] = conversation.id
                    yield f"data: {json.dumps(event)}\n\n"
            except (GeneratorExit, ConnectionResetError, BrokenPipeError):
                logger.info("Client disconnected from stream for query %s", query.id)
                _mark_query_stopped_and_log(query)
            except Exception as exc:
                logger.exception("Error during AskStreamView execution")
                _mark_query_failed_and_log(query)
                yield f"data: {json.dumps({'type': 'error', 'message': GENERIC_ASK_ERROR})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class QueryViewSet(viewsets.ModelViewSet):
    """ViewSet untuk CRUD query pengguna."""

    queryset = Query.objects.all()
    serializer_class = QuerySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter query berdasarkan user yang sedang login."""
        user = self.request.user
        if user.role == "admin":
            return Query.objects.filter(deleted_at__isnull=True).select_related("conversation")
        return Query.objects.filter(user=user, deleted_at__isnull=True).select_related("conversation")

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
    def stop(self, request, pk=None):
        """
        POST /api/queries/{id}/stop/
        Menghentikan proses pipeline query yang sedang berjalan.
        """
        query = self.get_object()
        if query.status == Query.Status.PENDING:
            query.status = Query.Status.STOPPED
            query.current_step = "stopped"
            query.save(update_fields=["status", "current_step", "updated_at"])
            History.objects.get_or_create(user=query.user, conversation=query.conversation, query=query)
        return Response({"status": query.status, "query_id": query.id})

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
                {"detail": "Pertanyaan wajib diisi."},
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
        base_qs = History.objects.select_related(
            "conversation", "query", "query__user", "answer", "answer__query", "user"
        ).order_by("-id")
        if user.role == "admin":
            return base_qs
        return base_qs.filter(user=user)


class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet untuk manajemen conversation."""

    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        return ConversationSerializer

    def get_queryset(self):
        """Filter conversation berdasarkan user yang sedang login dan search query.

        Admin tidak dapat melihat conversation milik user lain — setiap user
        (termasuk admin) hanya melihat conversation milik dirinya sendiri.
        """
        user = self.request.user
        qs = Conversation.objects.filter(user=user)
        
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(queries__query_text__icontains=q) |
                Q(queries__query_title__icontains=q)
            ).distinct()
        
        return qs.prefetch_related("queries").order_by("-updated_at")

    def perform_create(self, serializer):
        """Set user_id otomatis dari user yang sedang login."""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"], url_path="messages")
    def get_messages(self, request, pk=None):
        """Mengambil semua message dalam conversation tertentu."""
        conversation = self.get_object()

        # ponytail: single prefetch covers answers without N+1 queries. Upgrade to cursor pagination if messages exceed 500 turns.
        queries = (
            Query.objects.filter(conversation=conversation)
            .select_related("user")
            .prefetch_related(
                Prefetch(
                    "answers",
                    queryset=Answer.objects.filter(deleted_at__isnull=True),
                )
            )
            .order_by("created_at")
        )

        messages = []
        for query in queries:
            messages.append({
                "id": query.id,
                "role": "user",
                "content": query.query_text,
                "created_at": query.created_at.isoformat(),
            })

            for answer in query.answers.all():
                messages.append({
                    "id": answer.id,
                    "role": "assistant",
                    "content": answer.answer_text,
                    "sources": answer.sources or [],
                    "response_time_ms": query.response_time_ms,
                    "created_at": answer.created_at.isoformat(),
                })

        return Response({
            "conversation_id": conversation.id,
            "messages": messages,
        })

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """Search conversations by title or query text."""
        q = request.query_params.get("q", "").strip()
        
        if not q:
            return Response({"results": []})
        
        user = request.user
        # Setiap user (termasuk admin) hanya dapat mencari conversation milik
        # dirinya sendiri — konsisten dengan aturan akses pada endpoint list.
        base_filter = Q(user=user)
        conversations = Conversation.objects.filter(
            base_filter &
            (Q(title__icontains=q) | Q(queries__query_text__icontains=q) | Q(queries__query_title__icontains=q))
        ).distinct().order_by("-updated_at")[:20]
        
        results = []
        for conv in conversations:
            messages = []
            for query in conv.queries.all()[:5]:
                messages.append({
                    "role": "user",
                    "content": query.query_text,
                    "created_at": query.created_at.isoformat()
                })
            
            results.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at.isoformat(),
                "messages": messages
            })
        
        return Response({"results": results})
