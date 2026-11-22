"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { GlassButton } from "@/components/ui/GlassButton";
import DocumentStats from "./DocumentStats";
import UploadModal from "./UploadModal";
import DocumentDetailDrawer, {
    type DocumentItem,
} from "./DocumentDetailDrawer";

interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

interface SummaryData {
    total: number;
    indexed: number;
    processing: number;
    failed: number;
}

// ponytail: in-component document state with 10-item paging meets PBL dashboard scope; upgrade to server-side query caching (e.g. SWR/TanStack Query) if document volume grows to thousands.
export default function ManageSection() {
    const router = useRouter();
    const user = getUser();
    const isAdmin = user?.role === "admin" && user.is_staff === true;

    const [docs, setDocs] = useState<DocumentItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [stats, setStats] = useState<SummaryData>({
        total: 0,
        indexed: 0,
        processing: 0,
        failed: 0,
    });
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [dateSort, setDateSort] = useState<string>("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Detail Drawer state
    const [drawerDoc, setDrawerDoc] = useState<DocumentItem | null>(null);
    const [drawerTab, setDrawerTab] = useState<"chunks" | "logs" | "visual">("chunks");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Upload Modal state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Multi-selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Action dropdown menu state
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Redirect non-admin
    useEffect(() => {
        if (!isAdmin) router.replace("/");
    }, [isAdmin, router]);

    // Close action menu when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        }
        if (openMenuId !== null) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openMenuId]);

    // Data fetching
    const refreshDocs = useCallback(async (page: number = 1) => {
        setLoadingDocs(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
            });
            if (statusFilter !== "all") params.append("status", statusFilter);
            if (typeFilter !== "all") params.append("file_type", typeFilter);
            if (search.trim()) params.append("document_name", search.trim());

            const res = await api.get<PaginatedResponse<DocumentItem>>(
                `/documents/?${params.toString()}`,
            );
            setDocs(res.results || []);
            setTotalPages(Math.max(1, Math.ceil((res.count || 0) / 10)));
            setCurrentPage(page);
        } catch {
            setDocs([]);
        } finally {
            setLoadingDocs(false);
        }
    }, [statusFilter, typeFilter, search]);

    const fetchSummary = useCallback(async () => {
        try {
            const data = await api.get<SummaryData>("/documents/summary/");
            setStats(data);
        } catch {
            setStats({ total: 0, indexed: 0, processing: 0, failed: 0 });
        }
    }, []);

    // Initial load & filter change
    useEffect(() => {
        const timer = setTimeout(() => {
            void refreshDocs(1);
            void fetchSummary();
        }, 150);
        return () => clearTimeout(timer);
    }, [refreshDocs, fetchSummary]);

    // Background polling while processing
    useEffect(() => {
        const hasProcessing = docs.some((doc) => {
            const st = doc.status.toLowerCase();
            return st === "processing" || st === "pending";
        });
        if (!hasProcessing) return;

        const intervalId = setInterval(() => {
            void refreshDocs(currentPage);
            void fetchSummary();
        }, 3000);

        return () => clearInterval(intervalId);
    }, [docs, currentPage, refreshDocs, fetchSummary]);

    // Sorted client-side docs for date order
    const sortedDocs = useMemo(() => {
        const result = [...docs];
        result.sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            return dateSort === "newest" ? timeB - timeA : timeA - timeB;
        });
        return result;
    }, [docs, dateSort]);

    // Multi-selection helpers
    const allSelected =
        sortedDocs.length > 0 && sortedDocs.every((doc) => selectedIds.has(doc.id));
    const someSelected = selectedIds.size > 0;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sortedDocs.map((d) => d.id)));
        }
    };

    const toggleSelectOne = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // Actions
    const handleOpenDetail = (doc: DocumentItem, tab: "chunks" | "logs" | "visual") => {
        setDrawerDoc(doc);
        setDrawerTab(tab);
        setIsDrawerOpen(true);
        setOpenMenuId(null);
    };

    const handleDelete = async (doc: DocumentItem) => {
        if (!window.confirm(`Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`)) {
            return;
        }
        try {
            await api.delete(`/documents/${doc.id}/`);
            if (drawerDoc?.id === doc.id) setIsDrawerOpen(false);
            setOpenMenuId(null);
            await Promise.all([refreshDocs(currentPage), fetchSummary()]);
        } catch {
            setUploadError("Gagal menghapus dokumen.");
        }
    };

    const handleReIngest = async (doc: DocumentItem) => {
        try {
            await api.post(`/ingest/${doc.id}/re-ingest/`, {});
            setOpenMenuId(null);
            await Promise.all([refreshDocs(currentPage), fetchSummary()]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Gagal memulai re-ingest dokumen.";
            setUploadError(msg);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Hapus ${selectedIds.size} dokumen yang dipilih?`)) return;

        const results = await Promise.allSettled(
            Array.from(selectedIds).map((id) => api.delete(`/documents/${id}/`)),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
            setUploadError(`${failed} dokumen gagal dihapus.`);
        }
        setSelectedIds(new Set());
        await Promise.all([refreshDocs(currentPage), fetchSummary()]);
    };

    const handleBulkReIngest = async () => {
        if (selectedIds.size === 0) return;
        const results = await Promise.allSettled(
            Array.from(selectedIds).map((id) =>
                api.post(`/ingest/${id}/re-ingest/`, {}),
            ),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
            setUploadError(`${failed} dokumen gagal di-re-ingest.`);
        }
        setSelectedIds(new Set());
        await Promise.all([refreshDocs(currentPage), fetchSummary()]);
    };

    const submitUpload = async (file: File) => {
        setIsUploading(true);
        setUploadError(null);
        try {
            const formData = new FormData();
            formData.append("document", file);
            await api.uploadFile("/ingest/upload/", formData);
            setIsUploadOpen(false);
            await Promise.all([refreshDocs(1), fetchSummary()]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Gagal mengunggah dokumen.";
            setUploadError(msg);
        } finally {
            setIsUploading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                Anda tidak memiliki izin untuk mengakses halaman upload.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden relative">
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6 overflow-y-auto">
                {/* Header Title */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#0f2436] dark:text-[#f0f6fc]">
                            Manajemen Dokumen
                        </h1>
                        <p className="text-xs md:text-sm text-[#0f2436]/60 dark:text-[#f0f6fc]/60 mt-0.5">
                            Kelola koleksi pengetahuan, pantau pipeline OCR, dan periksa status chunking
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <GlassButton
                            variant="primary"
                            size="md"
                            onClick={() => {
                                setUploadError(null);
                                setIsUploadOpen(true);
                            }}
                            className="w-full sm:w-auto"
                        >
                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Upload Dokumen
                        </GlassButton>
                    </div>
                </div>

                {/* KPI Metrics */}
                <DocumentStats
                    stats={stats}
                    activeFilter={statusFilter}
                    onSelectFilter={(st) => setStatusFilter(st)}
                />

                {/* Error Banner */}
                {uploadError && (
                    <div className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 shrink-0">
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                            <span>{uploadError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setUploadError(null)}
                            className="text-xs underline hover:opacity-80"
                        >
                            Tutup
                        </button>
                    </div>
                )}

                {/* Filter & Search Bar */}
                <div className="shrink-0 flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="flex-1 min-w-[220px] relative">
                        <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 glass-input">
                            <svg className="h-4 w-4 shrink-0 text-[#0f2436]/40 dark:text-[#f0f6fc]/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari berdasarkan nama dokumen..."
                                className="w-full bg-transparent text-xs text-[#0f2436] dark:text-[#f0f6fc] outline-none placeholder:text-[#0f2436]/40 dark:placeholder:text-[#f0f6fc]/40"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="text-xs text-[#0f2436]/40 hover:text-[#0f2436] dark:text-[#f0f6fc]/40 dark:hover:text-[#f0f6fc]"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Status */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-2xl px-3.5 py-2.5 text-xs text-[#0f2436] dark:text-[#f0f6fc] glass-input outline-none cursor-pointer"
                        aria-label="Filter status dokumen"
                    >
                        <option value="all" className="dark:bg-slate-900">Semua Status</option>
                        <option value="indexed" className="dark:bg-slate-900">Indexed</option>
                        <option value="processing" className="dark:bg-slate-900">Processing</option>
                        <option value="failed" className="dark:bg-slate-900">Failed</option>
                    </select>

                    {/* Filter Type */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="rounded-2xl px-3.5 py-2.5 text-xs text-[#0f2436] dark:text-[#f0f6fc] glass-input outline-none cursor-pointer"
                        aria-label="Filter tipe file"
                    >
                        <option value="all" className="dark:bg-slate-900">Semua Tipe</option>
                        <option value="pdf" className="dark:bg-slate-900">PDF</option>
                        <option value="docx" className="dark:bg-slate-900">DOCX</option>
                        <option value="txt" className="dark:bg-slate-900">TXT</option>
                    </select>

                    {/* Sort Order */}
                    <select
                        value={dateSort}
                        onChange={(e) => setDateSort(e.target.value)}
                        className="rounded-2xl px-3.5 py-2.5 text-xs text-[#0f2436] dark:text-[#f0f6fc] glass-input outline-none cursor-pointer"
                        aria-label="Urutan tanggal"
                    >
                        <option value="newest" className="dark:bg-slate-900">Terbaru</option>
                        <option value="oldest" className="dark:bg-slate-900">Terlama</option>
                    </select>

                    {/* Refresh Button */}
                    <GlassButton
                        variant="glass"
                        size="md"
                        onClick={() => {
                            void refreshDocs(currentPage);
                            void fetchSummary();
                        }}
                        disabled={loadingDocs}
                        className="h-[41px]"
                    >
                        <svg
                            className={`h-4 w-4 mr-1.5 ${loadingDocs ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Segarkan
                    </GlassButton>
                </div>

                {/* Main Content Area */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl glass-panel border shadow-lg">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1">
                        <table className="w-full table-fixed text-left text-xs border-collapse">
                            <thead className="sticky top-0 z-10 bg-white/70 dark:bg-slate-900/80 backdrop-blur-md border-b border-white/10 dark:border-white/5">
                                <tr className="text-[#0f2436]/70 dark:text-[#f0f6fc]/70 uppercase tracking-wider text-[11px] font-semibold">
                                    <th className="w-[5%] p-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            className="h-4 w-4 rounded accent-primary cursor-pointer"
                                            aria-label="Pilih semua dokumen"
                                        />
                                    </th>
                                    <th className="w-[35%] p-4">Nama Dokumen</th>
                                    <th className="w-[10%] p-4">Tipe</th>
                                    <th className="w-[10%] p-4">Ukuran</th>
                                    <th className="w-[13%] p-4">Tanggal Unggah</th>
                                    <th className="w-[8%] p-4 text-center">Chunk</th>
                                    <th className="w-[11%] p-4">Status</th>
                                    <th className="w-[8%] p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 dark:divide-white/5">
                                {loadingDocs ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-sm text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                                </svg>
                                                <span>Memuat daftar dokumen...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-14 text-center text-sm text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="h-8 w-8 text-[#0f2436]/30 dark:text-[#f0f6fc]/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                </svg>
                                                <span>Tidak ada dokumen yang ditemukan.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedDocs.map((doc) => {
                                        const isSelected = selectedIds.has(doc.id);
                                        const normStatus = doc.status.toLowerCase();
                                        const isIndexed = ["indexed", "completed", "success"].includes(normStatus);
                                        const isProc = ["processing", "pending"].includes(normStatus);
                                        const isFail = ["failed", "error"].includes(normStatus);

                                        return (
                                            <tr
                                                key={doc.id}
                                                className={`transition-colors hover:bg-white/40 dark:hover:bg-slate-800/40 ${
                                                    isSelected ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <td className="p-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectOne(doc.id)}
                                                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                                                        aria-label={`Pilih ${doc.document_name}`}
                                                    />
                                                </td>

                                                {/* Document Name */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenDetail(doc, "chunks")}
                                                                className="truncate font-semibold text-[#0f2436] dark:text-[#f0f6fc] hover:text-primary transition-colors text-left block max-w-full cursor-pointer"
                                                                title={doc.document_name}
                                                            >
                                                                {doc.document_name}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* File Type */}
                                                <td className="p-4">
                                                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-black/5 dark:bg-white/10 text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                                                        {doc.file_type?.toUpperCase() || "DOC"}
                                                    </span>
                                                </td>

                                                {/* File Size */}
                                                <td className="p-4 text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                                                    {doc.size_human ?? `${Math.round(doc.size / 1024)} KB`}
                                                </td>

                                                {/* Upload Date */}
                                                <td className="p-4 text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                                                    {new Date(doc.created_at).toLocaleDateString("id-ID", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </td>

                                                {/* Chunks Count */}
                                                <td className="p-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetail(doc, "chunks")}
                                                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                                                        title="Buka rincian chunk"
                                                    >
                                                        {doc.chunk_count ?? 0}
                                                    </button>
                                                </td>

                                                {/* Status */}
                                                <td className="p-4">
                                                    {isIndexed ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            Indexed
                                                        </span>
                                                    ) : isProc ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                                            </svg>
                                                            Processing
                                                        </span>
                                                    ) : isFail ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                            Failed
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                                                            {doc.status}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Action Menu */}
                                                <td className="p-4 text-center">
                                                    <div className="relative inline-block">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                            aria-label="Menu aksi dokumen"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                                                            </svg>
                                                        </button>

                                                        {openMenuId === doc.id && (
                                                            <div
                                                                ref={menuRef}
                                                                className="absolute right-0 z-20 mt-1 w-48 rounded-2xl glass-panel border shadow-xl p-1.5 text-left text-xs animate-in fade-in zoom-in-95 duration-150"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenDetail(doc, "chunks")}
                                                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[#0f2436] dark:text-[#f0f6fc] hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                                                    </svg>
                                                                    Lihat Chunk
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenDetail(doc, "logs")}
                                                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[#0f2436] dark:text-[#f0f6fc] hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.667 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.667m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.008v.008H6.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                                                    </svg>
                                                                    Lihat Ingest Log
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenDetail(doc, "visual")}
                                                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[#0f2436] dark:text-[#f0f6fc] hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                                                    </svg>
                                                                    OCR & Vision
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleReIngest(doc)}
                                                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[#0f2436] dark:text-[#f0f6fc] hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                                    </svg>
                                                                    Re-ingest Dokumen
                                                                </button>
                                                                <div className="my-1 border-t border-white/10 dark:border-white/5" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleDelete(doc)}
                                                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                                    </svg>
                                                                    Hapus Dokumen
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View (< md) */}
                    <div className="block md:hidden overflow-y-auto flex-1 p-3 space-y-3">
                        {loadingDocs ? (
                            <div className="py-12 text-center text-xs text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                Memuat dokumen...
                            </div>
                        ) : sortedDocs.length === 0 ? (
                            <div className="py-12 text-center text-xs text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                Tidak ada dokumen ditemukan.
                            </div>
                        ) : (
                            sortedDocs.map((doc) => {
                                const isSelected = selectedIds.has(doc.id);
                                const normStatus = doc.status.toLowerCase();
                                const isIndexed = ["indexed", "completed", "success"].includes(normStatus);
                                const isProc = ["processing", "pending"].includes(normStatus);

                                return (
                                    <div
                                        key={doc.id}
                                        className={`rounded-2xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 p-4 space-y-3 transition-all ${
                                            isSelected ? "ring-2 ring-primary" : ""
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectOne(doc.id)}
                                                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                                                    aria-label={`Pilih ${doc.document_name}`}
                                                />
                                                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/10 text-primary">
                                                    {doc.file_type?.toUpperCase() || "DOC"}
                                                </span>
                                            </div>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                    isIndexed
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        : isProc
                                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                                }`}
                                            >
                                                {doc.status}
                                            </span>
                                        </div>

                                        <p
                                            onClick={() => handleOpenDetail(doc, "chunks")}
                                            className="font-semibold text-sm text-[#0f2436] dark:text-[#f0f6fc] cursor-pointer"
                                        >
                                            {doc.document_name}
                                        </p>

                                        <div className="flex items-center justify-between text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                                            <span>{doc.size_human ?? `${Math.round(doc.size / 1024)} KB`}</span>
                                            <span>{doc.chunk_count ?? 0} Chunks</span>
                                            <span>
                                                {new Date(doc.created_at).toLocaleDateString("id-ID", {
                                                    day: "numeric",
                                                    month: "short",
                                                })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 border-t border-white/10 dark:border-white/5 pt-3">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenDetail(doc, "chunks")}
                                                className="flex-1 rounded-xl bg-primary/10 py-1.5 text-xs font-semibold text-primary text-center hover:bg-primary/20"
                                            >
                                                Detail
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleReIngest(doc)}
                                                className="rounded-xl border border-white/10 p-1.5 text-xs text-[#0f2436]/70 dark:text-[#f0f6fc]/70"
                                                title="Re-ingest"
                                            >
                                                ↻
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(doc)}
                                                className="rounded-xl border border-rose-500/20 p-1.5 text-xs text-rose-600 dark:text-rose-400"
                                                title="Hapus"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination Bar */}
                    <div className="flex items-center justify-between border-t border-white/10 dark:border-white/5 px-4 md:px-6 py-3 bg-white/30 dark:bg-slate-900/40 shrink-0 text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                        <span>
                            Halaman {currentPage} dari {totalPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={currentPage <= 1 || loadingDocs}
                                onClick={() => void refreshDocs(currentPage - 1)}
                                className="flex h-8 items-center justify-center rounded-xl px-3 border border-white/10 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                                ← Sebelumnya
                            </button>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages || loadingDocs}
                                onClick={() => void refreshDocs(currentPage + 1)}
                                className="flex h-8 items-center justify-center rounded-xl px-3 border border-white/10 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                                Selanjutnya →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {someSelected && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full glass-panel border px-5 py-2.5 shadow-2xl animate-in slide-in-from-bottom duration-200">
                    <span className="text-xs font-semibold text-[#0f2436] dark:text-[#f0f6fc]">
                        {selectedIds.size} dipilih
                    </span>
                    <div className="h-4 w-px bg-white/20 dark:bg-white/10" />
                    <button
                        type="button"
                        onClick={() => void handleBulkReIngest()}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-hover transition-colors cursor-pointer"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Re-ingest
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleBulkDelete()}
                        className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Hapus
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="rounded-full px-2.5 py-1 text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60 hover:text-[#0f2436] dark:hover:text-[#f0f6fc] transition-colors cursor-pointer"
                    >
                        Batal
                    </button>
                </div>
            )}

            {/* Document Detail Inspector Drawer */}
            <DocumentDetailDrawer
                doc={drawerDoc}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                activeTab={drawerTab}
                onChangeTab={setDrawerTab}
                onReIngest={handleReIngest}
            />

            {/* Upload Modal */}
            <UploadModal
                isOpen={isUploadOpen}
                onClose={() => {
                    setIsUploadOpen(false);
                    setUploadError(null);
                }}
                onUpload={submitUpload}
                isUploading={isUploading}
                uploadError={uploadError}
            />
        </div>
    );
}
