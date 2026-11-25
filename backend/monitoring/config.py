"""
Konfigurasi monitoring dan batas rate limiting / token.
Semua nilai dapat dikustomisasi via environment variable.
"""

import os

# ── Rate Limiting (Sliding Window) ──────────────────────────────────────────
# Default: 5 request per menit
RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "5"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

# ── Batas Token Harian per User ──────────────────────────────────────────────
# Default: 100k input token dan 100k output token per hari
DAILY_TOKEN_LIMIT_INPUT = int(os.getenv("DAILY_TOKEN_LIMIT_INPUT", "100000"))
DAILY_TOKEN_LIMIT_OUTPUT = int(os.getenv("DAILY_TOKEN_LIMIT_OUTPUT", "100000"))

# ── Pesan Error (Bahasa Indonesia) ──────────────────────────────────────────
RATE_LIMIT_ERROR_MESSAGE = (
    f"Batas frekuensi permintaan tercapai (maksimal {RATE_LIMIT_REQUESTS_PER_MINUTE} "
    f"permintaan per menit). Silakan tunggu beberapa saat."
)

DAILY_INPUT_LIMIT_ERROR_MESSAGE = (
    f"Batas token input harian Anda telah tercapai (maksimal {DAILY_TOKEN_LIMIT_INPUT:,} "
    f"token per hari). Silakan coba lagi besok."
)

DAILY_OUTPUT_LIMIT_ERROR_MESSAGE = (
    f"Batas token output harian Anda telah tercapai (maksimal {DAILY_TOKEN_LIMIT_OUTPUT:,} "
    f"token per hari). Silakan coba lagi besok."
)
