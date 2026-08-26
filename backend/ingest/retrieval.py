"""
retrieval.py — pgvector similarity search + RAG generation (Django port of
ai/query_api.py + ai/flask_api.py _process_ask).

Replaces FAISS index file with native pgvector similarity search on the
`chunks.embedding` column.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from django.db import transaction

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from core.models import Answer, Chunk, History, Query
from . import config
from .services import get_embeddings

logger = logging.getLogger(__name__)


def _format_context(chunks: list[Chunk]) -> str:
    """Format retrieved chunks into the context block for the LLM prompt."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.document.document_name
        doc_name = source.rsplit(".", 1)[0].replace("_", " ")
        header = f"[Sumber: {doc_name}]"
        parts.append(f"{header}\n{chunk.chunk_text}")
    return "\n\n---\n\n".join(parts)


def _similarity_search(question_vector: list[float], top_k: int) -> list[Chunk]:
    """
    Native pgvector similarity search (cosine distance) over chunks.embedding.
    Returns the top-k Chunk objects ordered by similarity.
    """
    from pgvector.django import CosineDistance

    qs = (
        Chunk.objects.filter(embedding__isnull=False)
        .annotate(distance=CosineDistance("embedding", question_vector))
        .order_by("distance")[:top_k]
    )
    return list(qs)


def _build_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=config.GEMINI_MODEL,
        google_api_key=config.GEMINI_API_KEY,
        temperature=config.GEMINI_TEMPERATURE,
        max_output_tokens=config.GEMINI_MAX_TOKENS,
        streaming=False,
    )


def _save_answer(query: Query, answer_text: str, sources: list[dict]) -> int:
    """Persist the answer and link it to the query via History."""
    with transaction.atomic():
        answer = Answer.objects.create(
            query=query,
            answer_text=answer_text,
            sources=sources,
        )
        History.objects.create(
            user=query.user,
            query=query,
            answer=answer,
        )
    return answer.id


def run_rag_query(query_id: int, question: str, top_k: int | None = None) -> dict[str, Any]:
    """
    Run the full RAG pipeline for a user question:
    embed question → pgvector similarity search → build context → Gemini → save.

    Returns a dict with answer, sources, response_time_ms, and answer_id.
    """
    top_k = top_k or config.TOP_K

    try:
        query = Query.objects.get(pk=query_id)
    except Query.DoesNotExist:
        raise ValueError(f"Query {query_id} not found")

    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set. Add it to your .env file.")

    start = time.time()

    # 1. Embed the question
    query.current_step = "embedding"
    query.save(update_fields=["current_step", "updated_at"])
    embeddings = get_embeddings()
    question_vector = embeddings.embed_query(question)

    # 2. pgvector similarity search
    query.current_step = "similarity_search"
    query.save(update_fields=["current_step", "updated_at"])
    chunks = _similarity_search(question_vector, top_k)

    if not chunks:
        raise ValueError(
            "No documents indexed yet. Please upload a document first."
        )

    # 3. Build context
    query.current_step = "context"
    query.save(update_fields=["current_step", "updated_at"])
    context = _format_context(chunks)

    # 4. Generate answer with Gemini
    query.current_step = "generate"
    query.save(update_fields=["current_step", "updated_at"])

    llm = _build_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", config.RAG_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    chain = prompt | llm | StrOutputParser()
    answer_text = chain.invoke({"context": context, "question": question})

    elapsed = round((time.time() - start) * 1000)

    # 5. Build sources from the retrieved chunks
    sources = [
        {
            "source": chunk.document.document_name,
            "page": None,
            "score": None,
            "excerpt": chunk.chunk_text[:200],
        }
        for chunk in chunks
    ]

    # 6. Persist answer + history, update query status
    answer_id = _save_answer(query, answer_text, sources)
    query.status = Query.Status.ANSWERED
    query.response_time_ms = elapsed
    query.current_step = "done"
    query.save(update_fields=["status", "response_time_ms", "current_step", "updated_at"])

    return {
        "success": True,
        "query_id": query_id,
        "answer_id": answer_id,
        "answer": answer_text,
        "response_time_ms": elapsed,
        "sources": sources,
    }