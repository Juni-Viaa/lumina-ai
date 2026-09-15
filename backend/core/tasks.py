"""Celery tasks for lumina Django app."""

from celery import shared_task

from core.models import Document


@shared_task
def ingest_document_task(document_id: int):
    """
    Process an uploaded document through the ingest pipeline.

    This is a placeholder task that can be extended with:
    1. Copy file to documents directory
    2. Load document content
    3. Preprocess and chunk text
    4. Generate embeddings
    5. Store chunks in database

    Args:
        document_id: The ID of the Document to process

    Returns:
        dict: Processing result
    """
    from pathlib import Path
    import shutil
    import logging

    from django.conf import settings
    from langchain_core.documents import Document as LangChainDocument
    from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_huggingface import HuggingFaceEmbeddings

    from core.models import IngestLog, Chunk
    from ingest.config import (
        EMBEDDING_MODEL,
        EMBEDDING_DEVICE,
        CHUNK_SIZE,
        CHUNK_OVERLAP,
        DOCUMENTS_DIR,
    )

    logger = logging.getLogger(__name__)

    try:
        document = Document.objects.get(id=document_id)

        logger.info(f"Starting ingest task for document {document_id}")

        # Step 1: Copy file to documents directory
        upload_path = Path(document.path_file)
        dest_path = DOCUMENTS_DIR / upload_path.name

        if dest_path.resolve() != upload_path.resolve():
            shutil.copy2(upload_path, dest_path)

        # Step 2: Load document
        suffix = upload_path.suffix.lower()
        if suffix == ".pdf":
            loader = PyPDFLoader(str(dest_path))
        elif suffix == ".docx":
            loader = Docx2txtLoader(str(dest_path))
        else:
            loader = TextLoader(str(dest_path), encoding="utf-8")

        docs = loader.load()

        # Step 3: Preprocess and chunk
        from ingest.services import get_embeddings
        embedding_model = get_embeddings()

        # Chunk documents
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
            length_function=len,
            add_start_index=True,
        )
        chunks = text_splitter.split_documents(docs)

        # Embed and store chunks
        texts = [f"passage: {chunk.page_content}" for chunk in chunks]
        vectors = embedding_model.embed_documents(texts)

        from django.utils import timezone

        with transaction.atomic():
            Chunk.objects.filter(document=document).delete()

            chunk_objs = []
            for chunk, vector in zip(chunks, vectors):
                page_number = chunk.metadata.get("page")
                chunk_objs.append(
                    Chunk(
                        document=document,
                        chunk_text=chunk.page_content,
                        page=int(page_number) + 1 if page_number is not None else None,
                        embedding=vector,
                    )
                )
            Chunk.objects.bulk_create(chunk_objs)

        # Mark as indexed
        document.status = Document.Status.INDEXED
        document.save()
        logger.info(f"Ingestion task completed successfully for document {document_id}")

        return {
            "status": "success",
            "document_id": document_id,
            "chunks_added": len(chunk_objs),
        }

    except Exception as e:
        logger.error(f"Ingestion task failed for document {document_id}: {e}")
        document.status = Document.Status.FAILED
        document.save()
        raise