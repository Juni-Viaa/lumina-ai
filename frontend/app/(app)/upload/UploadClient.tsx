"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface DocumentItem {
    id: number;
    document_name: string;
    size_human?: string | null;
    size: number;
    status: string;
    created_at: string;
    updated_at: string;
    total_chunk_count: number;
    document_text_chunk_count: number;
    ocr_chunk_count: number;
    vision_chunk_count: number;
    unclassified_chunk_count: number;
    processed_page_count: number;
    processing_duration_seconds: number | null;
}

interface ChunkMetadata {
    source_type?: "document_text" | "ocr" | "vision";
    image_ref?: string;
    ocr_confidence?: number;
    section?: number;
    [key: string]: unknown;
}

interface ChunkItem {
    id: number;
    chunk_text: string;
    page: number | null;
    metadata: ChunkMetadata;
}

interface IngestLogItem {
    id: number;
    step: string;
    message: string;
    status: string;
    metadata?: Record<string, unknown> | null;
    created_at: string;
}

type DocsPayload = DocumentItem[] | { results?: DocumentItem[] };
type DetailTab = "summary" | "visual" | "chunks" | "logs";
type OpenDetail = { documentId: number; tab: DetailTab } | null;

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"];

function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `Tipe file tidak didukung: ${ext}`;
    }

    if (file.size > 100 * 1024 * 1024) {
        return "Ukuran file melebihi batas 100 MB.";
    }

    return null;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
    return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return `${date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })} ${date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

function formatDuration(seconds: number | null): string {
    if (seconds == null || seconds < 0) return "-";
    if (seconds < 60) return `${seconds} detik`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
        ? `${minutes} menit ${remainingSeconds} detik`
        : `${minutes} menit`;
}

function sourceLabel(sourceType?: ChunkMetadata["source_type"]): string {
    if (sourceType === "ocr") return "OCR";
    if (sourceType === "vision") return "Gemini Vision";
    if (sourceType === "document_text") return "Teks Dokumen";
    return "Belum berlabel";
}

function sourceBadgeClass(sourceType?: ChunkMetadata["source_type"]): string {
    if (sourceType === "ocr") return "bg-amber-500/10 text-amber-700";
    if (sourceType === "vision") return "bg-violet-500/10 text-violet-700";
    if (sourceType === "document_text") return "bg-sky-500/10 text-sky-700";
    return "bg-slate-500/10 text-slate-600";
}

function statusBadgeClass(status: string): string {
    switch (status) {
        case "processing":
        case "pending":
            return "text-yellow-600";

        case "indexed":
        case "completed":
        case "success":
            return "text-green-600";

        case "failed":
        case "error":
            return "text-rose-500";

        default:
            return "text-[#1a3a52]/60";
    }
}

interface ProcessingDetailProps {
    document: DocumentItem;
    activeTab: DetailTab;
    chunks: ChunkItem[];
    logs: IngestLogItem[];
    loading: boolean;
    onTabChange: (tab: DetailTab) => void;
}

function ProcessingDetail({
    document,
    activeTab,
    chunks,
    logs,
    loading,
    onTabChange,
}: ProcessingDetailProps) {
    const [chunkFilter, setChunkFilter] = useState<"all" | "document_text" | "ocr" | "vision">("all");
    const filteredChunks = chunkFilter === "all"
        ? chunks
        : chunks.filter((chunk) => chunk.metadata?.source_type === chunkFilter);
    const visualChunks = chunks.filter((chunk) =>
        chunk.metadata?.source_type === "ocr" || chunk.metadata?.source_type === "vision",
    );
    const visualGroups = Array.from(
        visualChunks.reduce((groups, chunk) => {
            const key = chunk.metadata?.image_ref ?? `chunk-${chunk.id}`;
            const group = groups.get(key) ?? { imageRef: key, ocr: [], vision: [] };
            if (chunk.metadata?.source_type === "ocr") group.ocr.push(chunk);
            if (chunk.metadata?.source_type === "vision") group.vision.push(chunk);
            groups.set(key, group);
            return groups;
        }, new Map<string, { imageRef: string; ocr: ChunkItem[]; vision: ChunkItem[] }>()),
    ).map(([, group]) => group);

    const tabs: Array<{ id: DetailTab; label: string }> = [
        { id: "summary", label: "Ringkasan" },
        { id: "visual", label: "OCR & Vision" },
        { id: "chunks", label: "Semua Chunk" },
        { id: "logs", label: "Log Proses" },
    ];

    return (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/25 bg-white/15">
            <div className="flex gap-1 overflow-x-auto border-b border-white/20 p-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                            activeTab === tab.id
                                ? "bg-[#1a6fa8] text-white shadow-sm"
                                : "text-[#1a3a52]/65 hover:bg-white/20"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="max-h-[30rem] overflow-y-auto p-4">
                {activeTab === "summary" && (
                    <div className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                ["Total Chunk", document.total_chunk_count, "text-[#1a3a52]"],
                                ["Teks Dokumen", document.document_text_chunk_count, "text-sky-700"],
                                ["OCR", document.ocr_chunk_count, "text-amber-700"],
                                ["Gemini Vision", document.vision_chunk_count, "text-violet-700"],
                            ].map(([label, value, color]) => (
                                <div key={String(label)} className="rounded-2xl bg-white/25 p-3">
                                    <p className="text-[11px] uppercase tracking-wide text-[#1a3a52]/45">
                                        {label}
                                    </p>
                                    <p className={`mt-1 text-2xl font-semibold ${color}`}>
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 rounded-2xl bg-white/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-[#1a3a52]/45">Status</p>
                                <p className={`mt-1 font-semibold uppercase ${statusBadgeClass(document.status)}`}>
                                    {document.status}
                                </p>
                            </div>
                            <div>
                                <p className="text-[#1a3a52]/45">Durasi pemrosesan</p>
                                <p className="mt-1 font-medium text-[#1a3a52]">
                                    {formatDuration(document.processing_duration_seconds)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[#1a3a52]/45">Halaman terdeteksi</p>
                                <p className="mt-1 font-medium text-[#1a3a52]">
                                    {document.processed_page_count || "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-[#1a3a52]/45">Selesai diperbarui</p>
                                <p className="mt-1 font-medium text-[#1a3a52]">
                                    {formatDate(document.updated_at)}
                                </p>
                            </div>
                        </div>

                        {document.unclassified_chunk_count > 0 && (
                            <div className="rounded-xl border border-slate-400/15 bg-slate-100/30 px-3 py-2 text-xs text-[#1a3a52]/60">
                                {document.unclassified_chunk_count} chunk lama belum memiliki label asal.
                                Dokumen perlu di-ingest ulang jika label OCR, Vision, dan teks ingin dilengkapi.
                            </div>
                        )}

                        <p className="text-xs leading-relaxed text-[#1a3a52]/55">
                            Hasil OCR dan Gemini Vision sudah disimpan sebagai chunk terpisah.
                            Buka tab OCR &amp; Vision untuk membandingkan pembacaan dari gambar yang sama.
                        </p>
                    </div>
                )}

                {activeTab === "visual" && (
                    loading ? (
                        <p className="text-xs text-[#1a3a52]/50">Memuat hasil OCR dan Vision...</p>
                    ) : visualGroups.length === 0 ? (
                        <p className="text-xs text-[#1a3a52]/50">
                            Dokumen ini tidak memiliki hasil OCR atau Gemini Vision.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {visualGroups.map((group) => (
                                <div key={group.imageRef} className="rounded-2xl bg-white/20 p-3">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-[#1a3a52]">
                                            {group.imageRef}
                                        </p>
                                        <div className="flex gap-1.5 text-[10px]">
                                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">
                                                {group.ocr.length} OCR
                                            </span>
                                            <span className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-700">
                                                {group.vision.length} Vision
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-xl border border-amber-500/15 bg-amber-50/35 p-3">
                                            <p className="mb-2 text-xs font-semibold text-amber-700">
                                                OCR
                                                {group.ocr[0]?.metadata?.ocr_confidence != null &&
                                                    ` · keyakinan ${Math.round(group.ocr[0].metadata.ocr_confidence * 100)}%`}
                                            </p>
                                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#1a3a52]/70">
                                                {group.ocr.map((chunk) => chunk.chunk_text).join("\n\n") || "Tidak ada hasil OCR."}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-violet-500/15 bg-violet-50/35 p-3">
                                            <p className="mb-2 text-xs font-semibold text-violet-700">
                                                Gemini Vision
                                            </p>
                                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#1a3a52]/70">
                                                {group.vision.map((chunk) => chunk.chunk_text).join("\n\n") || "Tidak ada hasil Vision."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {activeTab === "chunks" && (
                    loading ? (
                        <p className="text-xs text-[#1a3a52]/50">Memuat chunk...</p>
                    ) : chunks.length === 0 ? (
                        <p className="text-xs text-[#1a3a52]/50">Belum ada chunk.</p>
                    ) : (
                        <div>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                {[
                                    ["all", "Semua"],
                                    ["document_text", "Teks Dokumen"],
                                    ["ocr", "OCR"],
                                    ["vision", "Gemini Vision"],
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setChunkFilter(value as typeof chunkFilter)}
                                        className={`rounded-full px-2.5 py-1 text-[11px] ${
                                            chunkFilter === value
                                                ? "bg-[#1a6fa8] text-white"
                                                : "bg-white/20 text-[#1a3a52]/65"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {filteredChunks.map((chunk, index) => (
                                    <div key={chunk.id} className="rounded-xl bg-white/20 p-3">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
                                            <span className="font-semibold text-[#1a3a52]/55">
                                                Chunk {index + 1}
                                            </span>
                                            <span className={`rounded-full px-2 py-1 ${sourceBadgeClass(chunk.metadata?.source_type)}`}>
                                                {sourceLabel(chunk.metadata?.source_type)}
                                            </span>
                                            {chunk.page != null && (
                                                <span className="text-[#1a3a52]/45">Halaman {chunk.page}</span>
                                            )}
                                            {chunk.metadata?.image_ref && (
                                                <span className="text-[#1a3a52]/45">{chunk.metadata.image_ref}</span>
                                            )}
                                            {chunk.metadata?.source_type === "ocr" && chunk.metadata.ocr_confidence != null && (
                                                <span className="text-amber-700">
                                                    Keyakinan {Math.round(chunk.metadata.ocr_confidence * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#1a3a52]/70">
                                            {chunk.chunk_text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}

                {activeTab === "logs" && (
                    loading ? (
                        <p className="text-xs text-[#1a3a52]/50">Memuat log proses...</p>
                    ) : logs.length === 0 ? (
                        <p className="text-xs text-[#1a3a52]/50">Belum ada log ingest.</p>
                    ) : (
                        <div className="space-y-2">
                            {logs.map((log) => (
                                <div key={log.id} className="grid gap-1 rounded-xl bg-white/20 p-3 text-xs sm:grid-cols-[9rem_8rem_1fr] sm:items-start">
                                    <p className="text-[#1a3a52]/45">{formatDate(log.created_at)}</p>
                                    <div>
                                        <p className="font-medium text-[#1a3a52]">{log.step}</p>
                                        <p className={statusBadgeClass(log.status)}>{log.status}</p>
                                    </div>
                                    <p className="text-[#1a3a52]/70">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default function UploadPage() {
    const router = useRouter();
    const user = getUser();
    const isAdmin = user?.role === "admin" && user.is_staff === true;

    useEffect(() => {
        if (!isAdmin) router.replace("/");
    }, [isAdmin, router]);

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#1a3a52]/70">
                Anda tidak memiliki izin untuk mengakses halaman upload.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 border-b border-white/10 px-5 py-5">
                <h3 className="text-lg font-semibold leading-tight text-[#1a3a52]">
                    Manajemen Dokumen
                </h3>
            </div>

            <ManageSection />
        </div>
    );
}

function ManageSection() {
    const [docs, setDocs] = useState<DocumentItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [search, setSearch] = useState("");
    const [openDetail, setOpenDetail] = useState<OpenDetail>(null);
    const [chunks, setChunks] = useState<ChunkItem[]>([]);
    const [logs, setLogs] = useState<IngestLogItem[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [chunksDocumentId, setChunksDocumentId] = useState<number | null>(null);
    const [logsDocumentId, setLogsDocumentId] = useState<number | null>(null);
    const docRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        const error = validateFile(file);

        if (error) {
            setUploadError(error);
            return;
        }

        setUploadError(null);
        setSelectedFile(file);
    }

    function onDragOver(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }

    function onDragLeave(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }

    function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (file) handleFile(file);

        event.target.value = "";
    }

    async function submitUpload() {
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            const form = new FormData();
            form.append("document", selectedFile);

            await api.uploadFile("/ingest/upload/", form);

            setIsUploadOpen(false);
            setSelectedFile(null);

            await refreshDocs();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Gagal mengunggah dokumen.";

            setUploadError(msg);
        } finally {
            setIsUploading(false);
        }
    }

    const refreshDocs = useCallback(async () => {
        setLoadingDocs(true);

        try {
            const payload = await api.get<DocsPayload>("/documents/");
            setDocs(Array.isArray(payload) ? payload : (payload.results ?? []));
        } catch {
            setDocs([]);
        } finally {
            setLoadingDocs(false);
        }
    }, []);

    useEffect(() => {
        void refreshDocs();
    }, [refreshDocs]);

    const recentDocs = useMemo(
        () =>
            docs
                .filter((doc) =>
                    doc.document_name
                        .toLocaleLowerCase("id-ID")
                        .includes(search.toLocaleLowerCase("id-ID")),
                )
                .sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                )
                .slice(0, 5),
        [docs, search],
    );

    function toggleDetail(doc: DocumentItem) {
        if (openDetail?.documentId === doc.id) {
            setOpenDetail(null);
            return;
        }

        setOpenDetail({ documentId: doc.id, tab: "summary" });
        setTimeout(() => {
            docRefs.current.get(doc.id)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 50);
    }

    async function selectDetailTab(doc: DocumentItem, tab: DetailTab) {
        setOpenDetail({ documentId: doc.id, tab });

        if (tab === "summary") return;

        if ((tab === "visual" || tab === "chunks") && chunksDocumentId === doc.id) {
            return;
        }
        if (tab === "logs" && logsDocumentId === doc.id) return;

        setLoadingDetail(true);

        try {
            if (tab === "visual" || tab === "chunks") {
                const data = await api.get<ChunkItem[]>(`/documents/${doc.id}/chunks/`);

                setChunks(Array.isArray(data) ? data : []);
                setChunksDocumentId(doc.id);
            } else {
                const data = await api.get<IngestLogItem[]>(
                    `/documents/${doc.id}/ingest_logs/`,
                );

                setLogs(Array.isArray(data) ? data : []);
                setLogsDocumentId(doc.id);
            }
        } catch {
            if (tab === "visual" || tab === "chunks") {
                setChunks([]);
                setChunksDocumentId(doc.id);
            } else {
                setLogs([]);
                setLogsDocumentId(doc.id);
            }
        } finally {
            setLoadingDetail(false);
        }
    }

    async function handleDelete(doc: DocumentItem) {
        if (
            !window.confirm(
                `Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`,
            )
        ) {
            return;
        }

        try {
            await api.delete(`/documents/${doc.id}/`);

            if (openDetail?.documentId === doc.id) {
                setOpenDetail(null);
            }

            await refreshDocs();
        } catch {
            return;
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
            <div className="shrink-0 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl p-4 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#1a3a52]/50">
                        Total Dokumen
                    </p>

                    <p className="mt-2 text-3xl font-semibold text-[#1a3a52]">
                        {docs.length}
                    </p>
                </div>

                <div className="rounded-2xl p-4 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#1a3a52]/50">
                        Total chunk
                    </p>

                    <p className="mt-2 text-3xl font-semibold text-[#1a3a52]">
                        {docs.reduce((total, doc) => total + (doc.total_chunk_count ?? 0), 0)}
                    </p>

                    <p className="mt-1 text-xs text-[#1a3a52]/45">
                        Teks dokumen, OCR, dan Gemini Vision.
                    </p>
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
                <svg
                    className="h-5 w-5 shrink-0 text-[#1a3a52]/45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                    />
                </svg>

                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari dokumen..."
                    className="w-full bg-transparent text-sm text-[#1a3a52] outline-none placeholder:text-[#1a3a52]/40"
                />
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#1a3a52]">Dokumen Terbaru</p>

                    <button
                        type="button"
                        onClick={() => {
                            setIsUploadOpen(true);
                            setSelectedFile(null);
                            setUploadError(null);
                        }}
                        className="rounded-xl bg-[#1a6fa8] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#155a85]"
                    >
                        + Upload Dokumen
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => void refreshDocs()}
                    className="rounded-xl px-3 py-2 text-sm text-[#1a3a52]/70 transition-colors hover:bg-white/15"
                >
                    Muat ulang
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
                {loadingDocs ? (
                    <div className="p-6 text-center text-sm text-[#1a3a52]/50">
                        Memuat dokumen...
                    </div>
                ) : recentDocs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#1a3a52]/50">
                        Tidak ada dokumen yang ditemukan.
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/10">
                        {recentDocs.map((doc) => (
                            <div
                                key={doc.id}
                                ref={(el) => {
                                    if (el) {
                                        docRefs.current.set(doc.id, el);
                                    } else {
                                        docRefs.current.delete(doc.id);
                                    }
                                }}
                                className="p-4"
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate text-sm font-medium text-[#1a3a52]">
                                                {doc.document_name}
                                            </p>

                                            <span
                                                className={`rounded-full bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide ${statusBadgeClass(
                                                    doc.status,
                                                )}`}
                                            >
                                                {doc.status}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-xs text-[#1a3a52]/45">
                                            {formatDate(doc.created_at)} -{" "}
                                            {doc.size_human ?? formatBytes(doc.size)}
                                        </p>

                                        {doc.total_chunk_count > 0 && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                                <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-700">
                                                    {doc.document_text_chunk_count} teks
                                                </span>
                                                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">
                                                    {doc.ocr_chunk_count} OCR
                                                </span>
                                                <span className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-700">
                                                    {doc.vision_chunk_count} Vision
                                                </span>
                                                {doc.unclassified_chunk_count > 0 && (
                                                    <span className="rounded-full bg-slate-500/10 px-2 py-1 text-slate-600">
                                                        {doc.unclassified_chunk_count} belum berlabel
                                                    </span>
                                                )}
                                                <span className="px-1 text-[#1a3a52]/45">
                                                    {formatDuration(doc.processing_duration_seconds)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleDetail(doc)}
                                            className="rounded-xl px-3 py-2 text-xs text-[#1a6fa8] transition-all hover:bg-white/15"
                                        >
                                            {openDetail?.documentId === doc.id
                                                ? "Tutup Detail"
                                                : "Detail Proses"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(doc)}
                                            className="rounded-xl px-3 py-2 text-xs text-rose-500 transition-all hover:bg-rose-500/10"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {openDetail?.documentId === doc.id && (
                                    <ProcessingDetail
                                        document={doc}
                                        activeTab={openDetail.tab}
                                        chunks={chunksDocumentId === doc.id ? chunks : []}
                                        logs={logsDocumentId === doc.id ? logs : []}
                                        loading={loadingDetail}
                                        onTabChange={(tab) => void selectDetailTab(doc, tab)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isUploadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[#1a3a52]">
                                Upload Dokumen
                            </h2>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsUploadOpen(false);
                                    setSelectedFile(null);
                                    setUploadError(null);
                                }}
                                className="rounded-lg p-1 text-[#1a3a52]/50 transition-colors hover:bg-gray-100 hover:text-[#1a3a52]"
                            >
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div
                            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                                isDragOver
                                    ? "border-[#1a6fa8] bg-[#1a6fa8]/5"
                                    : selectedFile
                                        ? "border-green-400 bg-green-50"
                                        : "border-gray-300 hover:border-[#1a6fa8]/50"
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    fileInputRef.current?.click();
                                }
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ALLOWED_EXTENSIONS.join(",")}
                                className="hidden"
                                onChange={handleFileInputChange}
                            />

                            {selectedFile ? (
                                <>
                                    <svg
                                        className="mb-3 h-10 w-10 text-green-500"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H5.625C5.004 2.25 4.5 2.754 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                        />
                                    </svg>

                                    <p className="text-sm font-medium text-[#1a3a52]">
                                        {selectedFile.name}
                                    </p>

                                    <p className="mt-1 text-xs text-[#1a3a52]/50">
                                        {formatBytes(selectedFile.size)}
                                    </p>

                                    <p className="mt-2 text-xs text-[#1a6fa8]">
                                        Klik untuk mengganti file
                                    </p>
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="mb-3 h-10 w-10 text-[#1a3a52]/30"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                                        />
                                    </svg>

                                    <p className="text-sm text-[#1a3a52]/70">
                                        {isDragOver
                                            ? "Lepaskan file di sini"
                                            : "Tarik & lepaskan file atau klik untuk memilih"}
                                    </p>

                                    <p className="mt-2 text-xs text-[#1a3a52]/40">
                                        PDF, DOCX, TXT, JPG, PNG, BMP, TIFF, WEBP - maks 100 MB
                                    </p>
                                </>
                            )}
                        </div>

                        {uploadError && (
                            <p className="mt-3 text-sm text-rose-500">{uploadError}</p>
                        )}

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsUploadOpen(false);
                                    setSelectedFile(null);
                                    setUploadError(null);
                                }}
                                disabled={isUploading}
                                className="rounded-xl px-4 py-2 text-sm text-[#1a3a52]/70 transition-colors hover:bg-gray-100 disabled:opacity-50"
                            >
                                Batal
                            </button>

                            <button
                                type="button"
                                onClick={() => void submitUpload()}
                                disabled={!selectedFile || isUploading}
                                className="rounded-xl bg-[#1a6fa8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#155a85] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <span className="flex items-center gap-2">
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />

                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                                            />
                                        </svg>
                                        Mengunggah...
                                    </span>
                                ) : (
                                    "Upload"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
