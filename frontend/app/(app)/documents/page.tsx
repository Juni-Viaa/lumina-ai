"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { documentsApi, type DocumentItem } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useDocumentSSE } from "@/hooks/useSSE";

// ponytail: basic document management list. Upgrade to paginated table if user document count exceeds 50.
export default function DocumentsPage() {
    const toast = useToast();
    const [docs, setDocs] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [ingestingId, setIngestingId] = useState<number | null>(null);

    const loadDocs = useCallback(async () => {
        try {
            const data = await documentsApi.list();
            setDocs(data.results);
        } catch {
            toast.error("Gagal memuat daftar dokumen.");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadDocs();
    }, [loadDocs]);

    // Real-time document updates via SSE
    useDocumentSSE({
        enabled: true,
        onDocStatus: (doc) => {
            setDocs((prev) =>
                prev.map((d) => (d.id === doc.id ? { ...d, status: doc.status } : d))
            );
            if (doc.status === "indexed") {
                toast.success(`Dokumen "${doc.document_name}" selesai diproses.`);
                void loadDocs();
            } else if (doc.status === "failed") {
                toast.error(`Dokumen "${doc.document_name}" gagal diproses.`);
                void loadDocs();
            }
        },
    });

    async function handleUpload(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!file) {
            toast.error("Pilih file terlebih dahulu.");
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            toast.error("Ukuran file melebihi batas 100 MB.");
            return;
        }

        const formData = new FormData();
        formData.append("document", file);

        setUploading(true);
        try {
            const data = await documentsApi.upload(formData);
            toast.success(data.message || "File berhasil diunggah.");
            setFile(null);
            void loadDocs();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload gagal.");
        } finally {
            setUploading(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await documentsApi.remove(deleteTarget.id);
            setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
            toast.success(`Dokumen "${deleteTarget.document_name}" berhasil dihapus.`);
            void loadDocs();
        } catch {
            toast.error("Gagal menghapus dokumen.");
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    async function handleIngest(docId: number) {
        setIngestingId(docId);
        try {
            await documentsApi.ingest(docId);
            toast.info("Memulai proses indeks dokumen...");
            setDocs((prev) =>
                prev.map((d) => (d.id === docId ? { ...d, status: "processing" } : d))
            );
        } catch {
            toast.error("Gagal memulai proses indeks.");
        } finally {
            setIngestingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                    <svg className="h-7 w-7 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium">Memuat dokumen...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                    Dokumen Saya
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Unggah dan kelola dokumen untuk basis pengetahuan RAG Lumina.
                </p>
            </div>

            {/* Upload Glass Card */}
            <GlassCard variant="panel" className="p-6">
                <form onSubmit={handleUpload}>
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (!uploading) setFile(e.dataTransfer.files[0] ?? null);
                        }}
                        className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-500/30 dark:border-blue-400/20 bg-blue-50/20 dark:bg-blue-950/10 p-8 text-center transition-all hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                    >
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                            </svg>
                        </div>

                        <label className="cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            Pilih file dari komputer
                            <input
                                type="file"
                                name="document"
                                className="sr-only"
                                disabled={uploading}
                                onChange={(e) => {
                                    setFile(e.target.files?.[0] ?? null);
                                    e.target.value = "";
                                }}
                                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.bmp,.tiff,.webp"
                            />
                        </label>

                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {file ? (
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                            ) : (
                                "atau seret dan lepas file ke area ini"
                            )}
                        </p>

                        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                            Format: PDF, DOCX, TXT, JPG, PNG (Maks. 100 MB)
                        </p>

                        {file && (
                            <div className="mt-4 flex items-center gap-2">
                                <GlassButton
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={uploading}
                                >
                                    {uploading ? "Mengunggah…" : "Unggah Sekarang"}
                                </GlassButton>
                                <GlassButton
                                    type="button"
                                    variant="glass"
                                    size="sm"
                                    disabled={uploading}
                                    onClick={() => setFile(null)}
                                >
                                    Batal
                                </GlassButton>
                            </div>
                        )}
                    </div>
                </form>
            </GlassCard>

            {/* Document List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#0f2436] dark:text-[#f0f6fc]">
                        Daftar Dokumen ({docs.length})
                    </h2>
                </div>

                {docs.length === 0 ? (
                    <GlassCard variant="inner" className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        Belum ada dokumen yang diunggah. Unggah dokumen pertama Anda di atas.
                    </GlassCard>
                ) : (
                    docs.map((doc) => {
                        const normStatus = doc.status.toLowerCase();
                        const isIndexed = ["indexed", "completed", "success"].includes(normStatus);
                        const isProc = ["processing", "pending"].includes(normStatus);

                        return (
                            <GlassCard
                                key={doc.id}
                                variant="inner"
                                className="flex items-center justify-between p-4 transition-all hover:border-blue-500/30"
                            >
                                <div className="min-w-0 flex-1 pr-4">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate font-semibold text-sm text-[#0f2436] dark:text-[#f0f6fc]">
                                            {doc.document_name}
                                        </p>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span>{(doc.size / (1024 * 1024)).toFixed(2)} MB</span>
                                        <span>•</span>
                                        <span className="font-semibold uppercase text-slate-600 dark:text-slate-300">
                                            {doc.file_type.toUpperCase()}
                                        </span>
                                        <span>•</span>
                                        <span className="inline-flex items-center gap-1">
                                            {doc.is_ocr ? (
                                                <>
                                                    <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                                    </svg>
                                                    <span>OCR Vision</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                    </svg>
                                                    <span>Teks Standar</span>
                                                </>
                                            )}
                                        </span>
                                        <span>•</span>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
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
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleIngest(doc.id)}
                                        disabled={isIndexed || isProc || ingestingId === doc.id}
                                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                                            isIndexed
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 opacity-60 cursor-default"
                                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                        title={isIndexed ? "Dokumen sudah terindeks" : "Indeks dokumen"}
                                    >
                                        {isIndexed ? (
                                            <>
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                </svg>
                                                <span>Terindeks</span>
                                            </>
                                        ) : ingestingId === doc.id || isProc ? (
                                            <>
                                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Memproses…</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                </svg>
                                                <span>Indeks</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(doc)}
                                        className="inline-flex items-center justify-center rounded-xl border border-rose-300/40 dark:border-rose-900/40 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title="Hapus dokumen"
                                        aria-label={`Hapus ${doc.document_name}`}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09 2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                            </GlassCard>
                        );
                    })
                )}
            </div>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={deleteTarget !== null}
                title="Hapus Dokumen"
                description={`Apakah Anda yakin ingin menghapus dokumen "${deleteTarget?.document_name}"? Dokumen dan seluruh indeks pencariannya akan dihapus secara permanen.`}
                confirmText="Hapus"
                cancelText="Batal"
                variant="danger"
                loading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
