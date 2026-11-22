"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GlassButton } from "@/components/ui/GlassButton";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => Promise<void>;
    isUploading: boolean;
    uploadError: string | null;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ponytail: single-file upload modal meets current admin requirement; upgrade to queued multi-file upload manager when batch upload endpoint is available.
export default function UploadModal({
    isOpen,
    onClose,
    onUpload,
    isUploading,
    uploadError,
}: UploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClose = useCallback(() => {
        if (isUploading) return;
        setSelectedFile(null);
        setValidationError(null);
        onClose();
    }, [isUploading, onClose]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape" && isOpen) {
                handleClose();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    function validateAndSetFile(file: File) {
        setValidationError(null);
        const ext = "." + file.name.split(".").pop()?.toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setValidationError(`Format file "${ext}" tidak didukung. Harap pilih file PDF, DOCX, atau TXT.`);
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setValidationError(`Ukuran file (${formatBytes(file.size)}) melebihi batas maksimum 100 MB.`);
            return;
        }

        setSelectedFile(file);
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) setIsDragOver(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (isUploading) return;

        const file = e.dataTransfer.files?.[0];
        if (file) validateAndSetFile(file);
    };

    function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (file) validateAndSetFile(file);
        event.target.value = "";
    }

    async function handleSubmit() {
        if (!selectedFile || isUploading) return;
        await onUpload(selectedFile);
        setSelectedFile(null);
    }

    const fileExt = selectedFile?.name.split(".").pop()?.toUpperCase() ?? "";
    const activeError = validationError || uploadError;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
        >
            <div
                className="w-full max-w-lg overflow-hidden rounded-3xl glass-panel border shadow-2xl transition-all"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 dark:border-white/5 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div>
                            <h2 id="upload-modal-title" className="text-base font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                                Upload Dokumen Baru
                            </h2>
                            <p className="text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                                Dokumen akan diproses ke RAG pipeline otomatis
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isUploading}
                        aria-label="Tutup dialog"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#0f2436]/50 dark:text-[#f0f6fc]/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Error Notice */}
                    {activeError && (
                        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300">
                            <svg className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                            <span className="flex-1 leading-relaxed">{activeError}</span>
                        </div>
                    )}

                    {/* Hidden Input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={handleFileInputChange}
                        disabled={isUploading}
                    />

                    {/* Dropzone Area */}
                    {!selectedFile ? (
                        <div
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                                isDragOver
                                    ? "border-primary bg-primary/10 scale-[1.01]"
                                    : "border-white/20 dark:border-white/10 hover:border-primary/50 hover:bg-white/5"
                            }`}
                        >
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 transition-transform duration-200 group-hover:scale-110">
                                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                                </svg>
                            </div>

                            <p className="text-sm font-semibold text-[#0f2436] dark:text-[#f0f6fc]">
                                Seret & letakkan file di sini
                            </p>
                            <p className="mt-1 text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                                atau <span className="text-primary font-medium underline underline-offset-2">pilih dari perangkat</span>
                            </p>

                            <div className="mt-4 flex items-center gap-2">
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-red-500/10 text-red-600 dark:text-red-400">PDF</span>
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400">DOCX</span>
                                <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-slate-500/10 text-slate-600 dark:text-slate-400">TXT</span>
                                <span className="text-[11px] text-[#0f2436]/50 dark:text-[#f0f6fc]/50">· Maks 100 MB</span>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase">
                                    {fileExt}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[#0f2436] dark:text-[#f0f6fc]">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60">
                                        {formatBytes(selectedFile.size)} · Siap diunggah
                                    </p>
                                </div>
                                {!isUploading && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFile(null)}
                                        aria-label="Batalkan file"
                                        className="rounded-lg p-1.5 text-[#0f2436]/50 dark:text-[#f0f6fc]/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Uploading progress bar */}
                            {isUploading && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-primary flex items-center gap-1.5">
                                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                            </svg>
                                            Memproses dokumen ke pipeline...
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse w-3/4" />
                                    </div>
                                    <p className="text-[11px] text-[#0f2436]/50 dark:text-[#f0f6fc]/50">
                                        Tahapan: Ekstraksi teks & OCR $\rightarrow$ Chunking $\rightarrow$ Dense/Sparse Embedding
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-white/10 dark:border-white/5 bg-black/5 dark:bg-white/5 px-6 py-4">
                    <GlassButton
                        variant="glass"
                        size="md"
                        onClick={handleClose}
                        disabled={isUploading}
                    >
                        Batal
                    </GlassButton>
                    <GlassButton
                        variant="primary"
                        size="md"
                        onClick={handleSubmit}
                        disabled={!selectedFile || isUploading}
                    >
                        {isUploading ? (
                            <span className="flex items-center gap-2">
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                                </svg>
                                Mengunggah...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                </svg>
                                Unggah Sekarang
                            </span>
                        )}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}
