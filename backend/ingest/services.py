"""
services.py — Django port of the RAG ingest pipeline (ai/ingest.py + ai/flask_api.py).

Pipeline: load → preprocess → chunk → embed → persist (pgvector).
Uses Django ORM + pgvector instead of raw MySQL + FAISS.
"""

from __future__ import annotations

import logging
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from django.db import transaction
from django.utils import timezone

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
)
from langchain_huggingface import HuggingFaceEmbeddings

from core.models import Document as DocumentModel, Chunk, IngestLog
from . import config
from ingest.ocr_service import ocr_document

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

def _log_ingest(
    document_id: int | None,
    step: str,
    message: str,
    session_id: str | None = None,
) -> None:
    """Insert an ingest log row."""
    if document_id is None:
        return
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


def _load_document(file_path: Path, document_id: int | None, session_id: str | None, is_ocr: bool = False) -> list[Document]:
    """Load a PDF/DOCX/TXT/image file into LangChain Documents.
    Image files use OCR via PaddleOCR when is_ocr=True."""
    suffix = file_path.suffix.lower()
    image_ext = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

    if is_ocr or suffix in image_ext:
        from ingest.ocr_service import ocr_document
        from ingest.vision_service import analyze_image, format_visual_analysis
        try:
            result = ocr_document(file_path)
            visual_text = format_visual_analysis(
                analyze_image(file_path, result["text"])
            )
            text = "\n".join(
                part for part in (result["text"], visual_text) if part
            )
        except Exception as exc:
            logger.error("OCR failed for %s: %s", file_path.name, exc)
            raise ValueError(f"OCR gagal untuk {file_path.name}: {exc}")
        _log_ingest(document_id, "ocr", f"OCR extracted {len(text)} chars from {file_path.name}", session_id)
        return [Document(
            page_content=text,
            metadata={"source_file": file_path.name, "page": 0, "ocr_used": True},
        )]

    if suffix == ".pdf":
        return _load_pdf_hybrid(file_path, document_id, session_id)
    elif suffix == ".docx":
        return _load_docx_hybrid(file_path, document_id, session_id)
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


def _ocr_docx_images(
    element: Any,
    document_part: Any,
    temp_dir: Path,
    surrounding_text: str = "",
) -> list[str]:
    """Extract and OCR raster images referenced by a DOCX XML element."""
    from docx.oxml.ns import qn
    from ingest.ocr_service import ocr_image
    from ingest.vision_service import analyze_image, format_visual_analysis

    supported_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    results: list[str] = []
    for image_number, blip in enumerate(element.xpath(".//a:blip"), start=1):
        relationship_id = blip.get(qn("r:embed"))
        image_part = document_part.related_parts.get(relationship_id)
        if image_part is None:
            continue

        suffix = Path(str(image_part.partname)).suffix.lower()
        if suffix not in supported_extensions:
            logger.info("Skipping unsupported DOCX image format: %s", suffix)
            continue

        image_path = temp_dir / f"image-{image_number}{suffix}"
        image_path.write_bytes(image_part.blob)
        blocks = ocr_image(image_path)
        ocr_text = " ".join(block["text"] for block in blocks).strip()
        visual_text = format_visual_analysis(
            analyze_image(image_path, ocr_text, surrounding_text)
        )
        combined_text = "\n".join(
            part for part in (ocr_text, visual_text) if part
        ).strip()
        if combined_text:
            results.append(combined_text)
    return results


def _load_docx_hybrid(
    file_path: Path,
    document_id: int | None,
    session_id: str | None,
) -> list[Document]:
    """Read DOCX text and insert OCR text near each embedded image."""
    from docx import Document as WordDocument
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    word_document = WordDocument(str(file_path))
    sections: list[Document] = []
    image_count = 0

    with tempfile.TemporaryDirectory(prefix="lumina-docx-ocr-") as temp_name:
        temp_dir = Path(temp_name)
        for section_index, element in enumerate(word_document.element.body.iterchildren()):
            if element.tag.endswith("}p"):
                extracted_text = Paragraph(element, word_document).text.strip()
            elif element.tag.endswith("}tbl"):
                table = Table(element, word_document)
                extracted_text = "\n".join(
                    " | ".join(cell.text.strip() for cell in row.cells)
                    for row in table.rows
                ).strip()
            else:
                continue

            try:
                image_texts = _ocr_docx_images(
                    element,
                    word_document.part,
                    temp_dir,
                    extracted_text,
                )
            except Exception as exc:
                logger.error("DOCX image OCR failed for %s: %s", file_path.name, exc)
                raise ValueError(f"OCR gambar DOCX gagal untuk {file_path.name}: {exc}") from exc

            image_count += len(image_texts)
            combined_text = extracted_text
            for image_text in image_texts:
                combined_text = _merge_pdf_page_text(combined_text, image_text)

            if combined_text:
                sections.append(Document(
                    page_content=combined_text,
                    metadata={
                        "source_file": file_path.name,
                        "section": section_index,
                        "ocr_used": bool(image_texts),
                    },
                ))

    _log_ingest(
        document_id,
        "ocr" if image_count else "load",
        f"Loaded {len(sections)} DOCX section(s); OCR extracted text from {image_count} image(s)",
        session_id,
    )
    return sections


def _pdf_pages_requiring_ocr(file_path: Path, docs: list[Document]) -> list[int]:
    """Select scanned pages and pages containing embedded images for OCR."""
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    selected: list[int] = []
    for page_index, page in enumerate(reader.pages):
        extracted_text = docs[page_index].page_content if page_index < len(docs) else ""
        has_little_text = len(extracted_text.strip()) < config.OCR_PDF_MIN_TEXT_CHARS
        try:
            has_images = bool(page.images)
        except Exception:  # noqa: BLE001 - malformed image metadata must not abort ingest
            has_images = False
        if has_little_text or has_images:
            selected.append(page_index)
    return selected


def _merge_pdf_page_text(extracted_text: str, ocr_text: str) -> str:
    """Combine PDF and OCR text while avoiding obvious full-page duplicates."""
    extracted_text = extracted_text.strip()
    ocr_text = ocr_text.strip()
    if not extracted_text:
        return ocr_text
    if not ocr_text:
        return extracted_text

    normalized_extracted = re.sub(r"\W+", "", extracted_text).lower()
    normalized_ocr = re.sub(r"\W+", "", ocr_text).lower()
    if normalized_ocr in normalized_extracted or normalized_extracted in normalized_ocr:
        return extracted_text if len(extracted_text) >= len(ocr_text) else ocr_text
    return f"{extracted_text}\n\n[Teks dari gambar]\n{ocr_text}"


def _load_pdf_hybrid(
    file_path: Path,
    document_id: int | None,
    session_id: str | None,
) -> list[Document]:
    """Extract digital text and OCR scanned/image-bearing PDF pages."""
    docs = PyPDFLoader(str(file_path)).load()
    for page_index, doc in enumerate(docs):
        doc.metadata.setdefault("page", page_index)
        doc.metadata.setdefault("source_file", file_path.name)

    selected_pages = _pdf_pages_requiring_ocr(file_path, docs)
    if not selected_pages:
        _log_ingest(document_id, "load", f"Loaded {len(docs)} PDF page(s); OCR not required", session_id)
        return docs

    from ingest.ocr_service import ocr_pdf_pages

    try:
        ocr_results = ocr_pdf_pages(
            file_path,
            selected_pages,
            analyze_visuals=True,
        )
    except Exception as exc:
        logger.error("PDF OCR failed for %s: %s", file_path.name, exc)
        raise ValueError(f"OCR PDF gagal untuk {file_path.name}: {exc}") from exc

    from ingest.vision_service import VisualAnalysis, format_visual_analysis

    results_by_page: dict[int, str] = {}
    for result in ocr_results:
        visual_data = result.get("visual_analysis")
        visual_text = format_visual_analysis(
            VisualAnalysis.model_validate(visual_data) if visual_data else None
        )
        results_by_page[result["page_num"] - 1] = "\n".join(
            part for part in (result["text"], visual_text) if part
        )
    for page_index in selected_pages:
        if page_index >= len(docs):
            docs.append(Document(page_content="", metadata={"page": page_index, "source_file": file_path.name}))
        docs[page_index].page_content = _merge_pdf_page_text(
            docs[page_index].page_content,
            results_by_page.get(page_index, ""),
        )
        docs[page_index].metadata["ocr_used"] = True

    _log_ingest(
        document_id,
        "ocr",
        f"OCR processed {len(selected_pages)} of {len(docs)} PDF page(s)",
        session_id,
    )
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
        document.is_ocr = any(chunk.metadata.get("ocr_used", False) for chunk in chunks)
        document.save(update_fields=["path_file", "is_ocr", "updated_at"])

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

        # Deteksi apakah perlu OCR (sebelum load, karena _load_document butuh flag ini)
        image_ext = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
        is_ocr = dest.suffix.lower() in image_ext

        # 2. Load document
        docs = _load_document(dest, document_id, session_id, is_ocr=is_ocr)

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
                is_ocr=is_ocr,
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
