"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface DocumentItem {
    id: number;
    document_name: string;
    file_type?: string;
    size_human?: string | null;
    size: number;
    status: string;
    created_at: string;
    chunk_count?: number;
}

export interface ChunkItem {
    id: number;
    chunk_text: string;
    page: number | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
}

export interface IngestLogItem {
    id: number;
    step: string;
    status?: string;
    message: string;
    error_message?: string;
    created_at: string;
}

export interface VisualGroupItem {
    imageRef: string;
    ocr: Array<{
        chunk_text: string;
        metadata?: {
            ocr_confidence?: number;
            [key: string]: unknown;
        };
    }>;
    vision: Array<{
        chunk_text: string;
        metadata?: Record<string, unknown>;
    }>;
}

interface DocumentDetailDrawerProps {
    doc: DocumentItem | null;
    isOpen: boolean;
    onClose: () => void;
    activeTab: "chunks" | "logs" | "visual";
    onChangeTab: (tab: "chunks" | "logs" | "visual") => void;
    onReIngest?: (doc: DocumentItem) => Promise<void>;
}

// ponytail: in-drawer tabs cover current deep inspection; upgrade to dedicated document workbench view if document annotation or manual chunk editing is needed.
export default function DocumentDetailDrawer({
    doc,
    isOpen,
    onClose,
    activeTab,
    onChangeTab,
    onReIngest,
}: DocumentDetailDrawerProps) {
    const [chunks, setChunks] = useState<ChunkItem[]>([]);
    const [logs, setLogs] = useState<IngestLogItem[]>([]);
    const [visualGroups, setVisualGroups] = useState<VisualGroupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedChunkId, setCopiedChunkId] = useState<number | null>(null);
    const [chunkSearch, setChunkSearch] = useState("");
    const [isReIngesting, setIsReIngesting] = useState(false);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape" && isOpen) {
                handleClose();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);

    useEffect(() => {
        if (!isOpen || !doc) return;
        let active = true;

        const loadData = async () => {
            setLoading(true);
            try {
                if (activeTab === "chunks") {
                    const res = await api.get<{ results: ChunkItem[] }>(`/documents/${doc.id}/chunks/`);
                    if (active) setChunks(Array.isArray(res?.results) ? res.results : []);
                } else if (activeTab === "logs") {
                    const res = await api.get<{ results: IngestLogItem[] }>(`/documents/${doc.id}/ingest_logs/`);
                    if (active) setLogs(Array.isArray(res?.results) ? res.results : []);
                } else if (activeTab === "visual") {
                    const res = await api.get<VisualGroupItem[] | { results?: VisualGroupItem[] }>(`/documents/${doc.id}/visual/`);
                    const raw = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
                    if (active) setVisualGroups(raw);
                }
            } catch {
                if (active) {
                    if (activeTab === "chunks") setChunks([]);
                    if (activeTab === "logs") setLogs([]);
                    if (activeTab === "visual") setVisualGroups([]);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        const timeout = setTimeout(() => {
            void loadData();
        }, 0);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [isOpen, doc, activeTab]);

    const handleCopy = async (id: number, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedChunkId(id);
            setTimeout(() => setCopiedChunkId(null), 2000);
        } catch {
            // Clipboard fallback
        }
    };

    const handleTriggerReIngest = async () => {
        if (!doc || !onReIngest || isReIngesting) return;
        setIsReIngesting(true);
        try {
            await onReIngest(doc);
            if (activeTab === "logs") {
                const res = await api.get<{ results: IngestLogItem[] }>(`/documents/${doc.id}/ingest_logs/`);
                setLogs(Array.isArray(res?.results) ? res.results : []);
            }
        } finally {
            setIsReIngesting(false);
        }
    };

    if (!isOpen || !doc) return null;

    const filteredChunks = chunkSearch.trim()
        ? chunks.filter((c) =>
              c.chunk_text.toLowerCase().includes(chunkSearch.toLowerCase()),
          )
        : chunks;

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs transition-opacity duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-document-title"
        >
            <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
                <div className="w-screen max-w-2xl glass-panel border-l flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
                    {/* Drawer Header */}
                    <div className="border-b border-white/10 dark:border-white/5 px-6 py-5 shrink-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                                        ID: {doc.id}
                                    </span>
                                    <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-white/10 text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                                        {doc.file_type?.toUpperCase() || "DOC"}
                                    </span>
                                    <span className="text-xs text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                        {doc.size_human ?? `${Math.round(doc.size / 1024)} KB`}
                                    </span>
                                </div>
                                <h2
                                    id="drawer-document-title"
                                    className="truncate text-lg font-bold text-[#0f2436] dark:text-[#f0f6fc]"
                                    title={doc.document_name}
                                >
                                    {doc.document_name}
                                </h2>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {onReIngest && (
                                    <button
                                        type="button"
                                        onClick={handleTriggerReIngest}
                                        disabled={isReIngesting}
                                        className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
                                        title="Jalankan ulang pipeline ingestion"
                                    >
                                        <svg
                                            className={`h-3.5 w-3.5 ${isReIngesting ? "animate-spin" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                        </svg>
                                        <span>{isReIngesting ? "Memproses..." : "Re-ingest"}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    aria-label="Tutup panel"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#0f2436]/50 dark:text-[#f0f6fc]/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Segmented Control Tabs */}
                        <div className="mt-5 flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-white/10 dark:border-white/5">
                            <button
                                type="button"
                                onClick={() => onChangeTab("chunks")}
                                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                                    activeTab === "chunks"
                                        ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                                        : "text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:text-[#0f2436] dark:hover:text-[#f0f6fc]"
                                }`}
                            >
                                Chunks {chunks.length > 0 && `(${chunks.length})`}
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeTab("logs")}
                                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                                    activeTab === "logs"
                                        ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                                        : "text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:text-[#0f2436] dark:hover:text-[#f0f6fc]"
                                }`}
                            >
                                Ingest Logs {logs.length > 0 && `(${logs.length})`}
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeTab("visual")}
                                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                                    activeTab === "visual"
                                        ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                                        : "text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:text-[#0f2436] dark:hover:text-[#f0f6fc]"
                                }`}
                            >
                                OCR & Vision {visualGroups.length > 0 && `(${visualGroups.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[#0f2436]/50 dark:text-[#f0f6fc]/50 gap-3">
                                <svg className="h-7 w-7 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                </svg>
                                <span className="text-sm">Memuat rincian dokumen...</span>
                            </div>
                        ) : activeTab === "chunks" ? (
                            <div className="space-y-3">
                                {chunks.length > 3 && (
                                    <div className="relative mb-3">
                                        <input
                                            type="text"
                                            value={chunkSearch}
                                            onChange={(e) => setChunkSearch(e.target.value)}
                                            placeholder="Cari dalam teks chunk..."
                                            className="w-full rounded-xl px-3.5 py-2 text-xs glass-input outline-none text-[#0f2436] dark:text-[#f0f6fc] placeholder:text-[#0f2436]/40 dark:placeholder:text-[#f0f6fc]/40"
                                        />
                                        {chunkSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setChunkSearch("")}
                                                className="absolute right-2.5 top-2 text-xs text-[#0f2436]/40 hover:text-[#0f2436]"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                )}

                                {filteredChunks.length === 0 ? (
                                    <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                        {chunks.length === 0
                                            ? "Belum ada chunk yang diekstraksi untuk dokumen ini."
                                            : "Tidak ada chunk yang cocok dengan kata kunci."}
                                    </div>
                                ) : (
                                    filteredChunks.map((chunk, idx) => (
                                        <div
                                            key={chunk.id}
                                            className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 p-4 transition-all hover:border-primary/30"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10 dark:border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                                                        Chunk #{idx + 1}
                                                    </span>
                                                    {chunk.page != null && (
                                                        <span className="text-[11px] text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                                            Halaman {chunk.page}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleCopy(chunk.id, chunk.chunk_text)}
                                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                >
                                                    {copiedChunkId === chunk.id ? (
                                                        <>
                                                            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                            </svg>
                                                            <span className="text-emerald-500 font-semibold">Tersalin!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                                                            </svg>
                                                            <span>Salin</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#0f2436]/80 dark:text-[#f0f6fc]/80 font-mono">
                                                {chunk.chunk_text}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : activeTab === "logs" ? (
                            <div className="space-y-3">
                                {logs.length === 0 ? (
                                    <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                        Tidak ada catatan log aktivitas untuk dokumen ini.
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10 dark:before:bg-white/5">
                                        {logs.map((log) => {
                                            const isErr = Boolean(log.error_message) || log.status === "failed";
                                            return (
                                                <div key={log.id} className="relative">
                                                    <span
                                                        className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background ${
                                                            isErr ? "bg-rose-500" : "bg-emerald-500"
                                                        }`}
                                                        aria-hidden="true"
                                                    />
                                                    <div className="rounded-xl border border-white/10 dark:border-white/5 bg-white/30 dark:bg-slate-900/30 p-3.5 space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-bold text-primary uppercase tracking-wide">
                                                                {log.step}
                                                            </span>
                                                            <span className="text-[10px] text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                                                {new Date(log.created_at).toLocaleString("id-ID")}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[#0f2436]/80 dark:text-[#f0f6fc]/80 leading-relaxed">
                                                            {log.message}
                                                        </p>
                                                        {log.error_message && (
                                                            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2 rounded-lg">
                                                                Error: {log.error_message}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {visualGroups.length === 0 ? (
                                    <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                        Dokumen ini tidak memiliki data OCR atau Gemini Vision.
                                    </div>
                                ) : (
                                    visualGroups.map((group, gIdx) => (
                                        <div
                                            key={group.imageRef || gIdx}
                                            className="rounded-2xl border border-white/10 dark:border-white/5 bg-white/30 dark:bg-slate-900/30 p-4 space-y-3"
                                        >
                                            <div className="flex items-center justify-between gap-2 border-b border-white/10 dark:border-white/5 pb-2">
                                                <span className="text-xs font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                                                    {group.imageRef || `Gambar #${gIdx + 1}`}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                                                        OCR ({group.ocr.length})
                                                    </span>
                                                    <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-violet-700 dark:text-violet-400 font-semibold">
                                                        Vision ({group.vision.length})
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {/* OCR Column */}
                                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                                                    <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                                                        <span>Paddle/Tesseract OCR</span>
                                                        {group.ocr[0]?.metadata?.ocr_confidence != null && (
                                                            <span className="text-[10px] font-normal opacity-80">
                                                                Keyakinan: {Math.round((group.ocr[0].metadata.ocr_confidence ?? 0) * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#0f2436]/80 dark:text-[#f0f6fc]/80 font-mono">
                                                        {group.ocr.map((c) => c.chunk_text).join("\n\n") || "Tidak ada teks OCR."}
                                                    </p>
                                                </div>

                                                {/* Gemini Vision Column */}
                                                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                                                    <div className="text-xs font-bold text-violet-700 dark:text-violet-400">
                                                        Gemini Vision
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#0f2436]/80 dark:text-[#f0f6fc]/80 font-mono">
                                                        {group.vision.map((c) => c.chunk_text).join("\n\n") || "Tidak ada deskripsi visual."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
