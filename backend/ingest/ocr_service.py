"""
ocr_service.py — PaddleOCR integration untuk Lumina AI.
Mengkonversi gambar/PDF ke teks menggunakan PaddleOCR.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from ingest import config

logger = logging.getLogger(__name__)

# Must be set BEFORE any paddle/paddlex import to avoid oneDNN crash on Windows
os.environ["PADDLE_DISABLE_ONE_DNN"] = "1"
os.environ["FLAGS_default_is_paddle_enabled"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

_ocr_engine: Any | None = None


def get_ocr_engine() -> Any:
    """Inisialisasi PaddleOCR (singleton)."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Initializing PaddleOCR (lang=%s)", config.OCR_LANG)
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(
            lang=config.OCR_LANG,
            use_textline_orientation=True,
        )
    return _ocr_engine


def _parse_ocr_result(result: Any) -> list[dict]:
    """Parse PaddleOCR 3.7.0 OCRResult into uniform dict list."""
    extracted = []
    if not result:
        return extracted

    # PaddleOCR 3.7.0: result[0] is an OCRResult (dict-like)
    # Keys: rec_texts, rec_scores, rec_polys
    ocr_result = result[0]
    texts = ocr_result.get("rec_texts", [])
    scores = ocr_result.get("rec_scores", [])
    polys = ocr_result.get("rec_polys", [])

    for i, (text, score) in enumerate(zip(texts, scores)):
        bbox = polys[i].tolist() if i < len(polys) else []
        extracted.append({
            "text": str(text),
            "confidence": float(score),
            "bbox": bbox,
        })
    return extracted


def ocr_image(file_path: Path) -> list[dict]:
    """
    Jalankan OCR pada satu gambar.

    Returns:
        list of dict: [{"text": ..., "confidence": ..., "bbox": ...}, ...]
    """
    engine = get_ocr_engine()
    result = engine.predict(str(file_path))

    extracted = _parse_ocr_result(result)

    logger.info("OCR: %d text blocks extracted from %s",
                len(extracted), file_path.name)
    return extracted


def ocr_pdf(file_path: Path) -> list[dict]:
    """
    Jalankan OCR pada PDF — extract per halaman sebagai gambar, lalu OCR.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise ImportError(
            "pdf2image diperlukan untuk OCR PDF. "
            "Install: pip install pdf2image poppler-utils"
        )

    # Poppler binary path for Windows
    poppler_path = str(config.POPPLER_PATH) if hasattr(config, 'POPPLER_PATH') else None

    images = convert_from_path(str(file_path), dpi=300, poppler_path=poppler_path)
    all_results = []

    for page_idx, img in enumerate(images):
        # Use Windows temp dir instead of /tmp
        temp_path = Path(os.path.dirname(os.path.abspath(file_path))) / f"ocr_page_{page_idx}.png"
        img.save(temp_path)
        page_texts = ocr_image(temp_path)
        all_results.append({
            "page_num": page_idx + 1,
            "text": " ".join(t["text"] for t in page_texts),
            "blocks": len(page_texts),
        })
        temp_path.unlink(missing_ok=True)

    logger.info("OCR PDF: %d pages processed from %s",
                len(all_results), file_path.name)
    return all_results


def ocr_document(file_path: Path) -> dict:
    """
    Entry point OCR — deteksi tipe file dan jalankan OCR yang tepat.

    Returns:
        dict: {"text": ..., "pages": ..., "raw_results": ...}
    """
    suffix = file_path.suffix.lower()
    image_ext = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

    if suffix in image_ext:
        results = ocr_image(file_path)
        text = " ".join(r["text"] for r in results)
        return {"text": text, "pages": 1, "raw_results": results}

    elif suffix == ".pdf":
        results = ocr_pdf(file_path)
        text = " ".join(r["text"] for r in results)
        return {"text": text, "pages": len(results), "raw_results": results}

    else:
        raise ValueError(f"Format tidak didukung untuk OCR: {suffix}")
