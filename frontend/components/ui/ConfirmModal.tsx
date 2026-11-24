"use client";

import { useEffect, useRef } from "react";
import { GlassButton } from "./GlassButton";

export interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary";
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

// ponytail: lightweight modal dialog without radix-ui. Upgrade to @radix-ui/react-dialog if complex focus restoration or nested dialogs are needed.
export function ConfirmModal({
    isOpen,
    title,
    description,
    confirmText = "Konfirmasi",
    cancelText = "Batal",
    variant = "danger",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape" && isOpen && !loading) {
                onCancel();
            }
        }
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, loading, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => !loading && onCancel()}
                aria-hidden="true"
            />

            {/* Modal Card */}
            <div
                ref={dialogRef}
                className="glass-panel relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl border border-white/40 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            >
                <div className="flex items-start gap-3.5 mb-4">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            variant === "danger"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        }`}
                        aria-hidden="true"
                    >
                        {variant === "danger" ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09 2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h2 id="confirm-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {title}
                        </h2>
                        <p id="confirm-modal-desc" className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                    <GlassButton
                        type="button"
                        variant="glass"
                        size="sm"
                        disabled={loading}
                        onClick={onCancel}
                    >
                        {cancelText}
                    </GlassButton>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                        className={`inline-flex items-center justify-center font-medium transition-all px-4 py-1.5 text-xs rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                            variant === "danger"
                                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/30"
                        }`}
                    >
                        {loading ? "Memproses…" : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
