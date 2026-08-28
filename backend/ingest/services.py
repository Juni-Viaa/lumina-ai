"""
services.py — Django port of the RAG ingest pipeline (ai/ingest.py + ai/flask_api.py).

Pipeline: load → preprocess → chunk → embed → persist (pgvector).
Uses Django ORM + pgvector instead of raw MySQL + FAISS.
"""

from __future__ import annotations

import logging
import re
import shutil
from pathlib import Path
from typing import Any

from django.db import transaction
from django.utils import timezone

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
)
from langchain_huggingface import HuggingFaceEmbeddings

from core.models import Document as DocumentModel, Chunk, IngestLog
from . import config

logger = logging.getLogger(__name__)

# ── Embedding model (lazy-loaded singleton) ────────────────────────────────────
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Load the HuggingFace embedding model once and cache it."""
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model: %s", config.EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(
            model_name=config.EMBEDDING_MODEL,
            model_kwargs={"device": config.EMBEDDING_DEVICE},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


# ── Logging helpers ────────────────────────────────────────────────────────────

def _log_ingest(document_id: int, step: str, message: str, session_id: str | None = None) -> None:
    """Insert an ingest log row."""
    try:
        IngestLog.objects.create(
            document_id=document_id,
            session_id=session_id,
            step=step,
            message=message,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to insert ingest log: %s", exc)


def _mark_failed(document_id: int | None, session_id: str | None, error_message: str) -> None:
    """Uniform failure path: logs an 'error' step and flips status to failed."""
    if document_id is None:
        return
    _log_ingest(document_id, "error", error_message, session_id)
    try:
        DocumentModel.objects.filter(pk=document_id).update(
            status=DocumentModel.Status.FAILED,
            updated_at=timezone.now(),
        )
    except Exception:  # noqa: BLE001
        pass


# ── Step functions ─────────────────────────────────────────────────────────────

def _copy_to_documents(file_path: Path, original_filename: str, document_id: int | None, session_id: str | None) -> Path:
    """Copy the uploaded file into the documents directory with UUID name."""
    safe_name = file_path.name
    dest = config.DOCUMENTS_DIR / safe_name
    if dest.resolve() != file_path.resolve():
        shutil.copy2(file_path, dest)
        _log_ingest(document_id, "copy", f"Copied to documents/{dest.name} (original: {original_filename})", session_id)
    else:
        _log_ingest(document_id, "copy", f"Already in documents/{file_path.name}", session_id)
    return dest


def _load_document(file_path: Path, document_id: int | None, session_id: str | None) -> list[Document]:
    """Load a PDF/DOCX/TXT file into LangChain Documents."""
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        loader = PyPDFLoader(str(file_path))
    elif suffix == ".docx":
        loader = Docx2txtLoader(str(file_path))
    elif suffix == ".txt":
        try:
            loader = TextLoader(str(file_path), encoding="utf-8")
        except Exception:  # noqa: BLE001
            loader = TextLoader(str(file_path), encoding="latin-1")
    else:
        raise ValueError(f"Unsupported extension '{suffix}'.")

    docs = loader.load()
    for doc in docs:
        doc.metadata.setdefault("source_file", file_path.name)

    _log_ingest(document_id, "load", f"Loaded {len(docs)} page(s)/section(s)", session_id)
    return docs


def _preprocess_documents(docs: list[Document], document_id: int | None, session_id: str | None) -> list[Document]:
    """Clean text: collapse excess newlines/whitespace, drop empty pages."""
    def clean(text: str) -> str:
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text.strip()

    cleaned = [
        Document(page_content=clean(d.page_content), metadata=d.metadata)
        for d in docs
        if len(clean(d.page_content)) > 50
    ]
    _log_ingest(document_id, "preprocess", f"Cleaned to {len(cleaned)} page(s)", session_id)
    return cleaned


def _chunk_documents(docs: list[Document], document_id: int | None, session_id: str | None) -> list[Document]:
    """Split documents into chunks using RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
        add_start_index=True,
    )
    chunks = splitter.split_documents(docs)
    _log_ingest(document_id, "chunk", f"Created {len(chunks)} chunks", session_id)
    return chunks


def _embed_and_persist(
    document: DocumentModel,
    file_path: Path,
    chunks: list[Document],
    session_id: str | None,
) -> int:
    """
    Embed all chunks and persist them to the `chunks` table (pgvector).
    Returns the number of chunks saved.
    """
    embeddings = get_embeddings()

    # Embed all chunk texts in one batch with E5 passage prefix
    texts = [f"passage: {chunk.page_content}" for chunk in chunks]
    vectors = embeddings.embed_documents(texts)

    with transaction.atomic():
        # Delete existing chunks for this document (re-ingest)
        Chunk.objects.filter(document=document).delete()

        # Update path_file
        document.path_file = str(file_path)
        document.save(update_fields=["path_file", "updated_at"])

        # Bulk-create chunks with embeddings and page metadata
        chunk_objs = []
        for chunk, vector in zip(chunks, vectors):
            page = chunk.metadata.get("page")
            chunk_objs.append(
                Chunk(
                    document=document,
                    chunk_text=chunk.page_content,
                    page=int(page) + 1 if page is not None else None,
                    embedding=vector,
                )
            )
        Chunk.objects.bulk_create(chunk_objs)

    _log_ingest(document.id, "mysql", f"Saved {len(chunk_objs)} chunks to pgvector", session_id)
    return len(chunk_objs)


def _mark_indexed(document_id: int, session_id: str | None) -> None:
    """Mark the document as indexed after all chunks are embedded and saved."""
    DocumentModel.objects.filter(pk=document_id).update(
        status=DocumentModel.Status.INDEXED,
        updated_at=timezone.now(),
    )
    _log_ingest(document_id, "complete", "All chunks stored", session_id)


# ── Main pipeline ──────────────────────────────────────────────────────────────

def run_ingest_pipeline(
    file_path: Path,
    original_filename: str,
    document_id: int | None = None,
    user_id: int | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """
    Run the full ingest pipeline: copy → load → preprocess → chunk → embed → persist.

    Returns a dict with `chunks_added`, `document_id`, and `file_path`.
    """
    try:
        # 1. Copy file into documents dir
        dest = _copy_to_documents(file_path, original_filename, document_id, session_id)

        # 2. Load document
        docs = _load_document(dest, document_id, session_id)

        # 3. Preprocess / clean
        docs = _preprocess_documents(docs, document_id, session_id)

        # 4. Chunk
        chunks = _chunk_documents(docs, document_id, session_id)

        # 5. Embed + persist to pgvector
        if document_id is None:
            # Create a new Document row if none exists
            if user_id is None:
                raise ValueError("user_id is required when document_id is not provided")
            document = DocumentModel.objects.create(
                user_id=user_id,
                document_name=original_filename,
                path_file=str(dest),
                file_type=dest.suffix.lstrip(".").lower(),
                size=dest.stat().st_size,
                status=DocumentModel.Status.PROCESSING,
                ingest_session_id=session_id,
            )
            document_id = document.id
        else:
            document = DocumentModel.objects.get(pk=document_id)

        chunks_added = _embed_and_persist(document, dest, chunks, session_id)

        # 6. Mark indexed
        _mark_indexed(document_id, session_id)

        return {
            "chunks_added": chunks_added,
            "document_id": document_id,
            "file_path": str(dest),
        }

    except Exception as exc:
        logger.exception("Ingest pipeline failed")
        _mark_failed(document_id, session_id, str(exc))
        raise