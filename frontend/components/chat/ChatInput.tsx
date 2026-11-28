"use client";

import { useRef } from "react";
import { GlassButton } from "@/components/ui/GlassButton";

interface ChatInputProps {
    question: string;
    setQuestion: (value: string) => void;
    onSubmit: () => void;
    onStop?: () => void;
    onRetry?: () => void;
    hasRetry?: boolean;
    loading: boolean;
    error?: string | null;
    showDisclaimer?: boolean;
}

export function ChatInput({
    question,
    setQuestion,
    onSubmit,
    onStop,
    onRetry,
    hasRetry = false,
    loading,
    error,
    showDisclaimer = true,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    function autoResize(el: HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) {
            onStop?.();
            return;
        }
        onSubmit();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!loading) {
                onSubmit();
            }
        }
    }

    return (
        <>
            {error && <p className="mb-1 text-xs text-red-500">{error}</p>}
            <form onSubmit={handleSubmit} className="glass-input flex items-center gap-2 rounded-3xl px-3.5 sm:px-5 py-1.5 sm:py-2">
                <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => {
                        setQuestion(e.target.value);
                        autoResize(e.target);
                    }}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ketik pertanyaanmu..."
                    spellCheck={false}
                    autoComplete="off"
                    disabled={loading}
                    className="max-h-[120px] min-h-[36px] flex-1 resize-none border-none bg-transparent py-2 text-sm text-[#0f2436] dark:text-[#f0f6fc] placeholder-[#3b82f6]/70 dark:placeholder-[#60a5fa]/70 outline-none disabled:opacity-50"
                />
                <div className="flex shrink-0 items-center gap-1.5">
                    {hasRetry && !loading && onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            title="Coba lagi pertanyaan sebelumnya"
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 transition-colors cursor-pointer"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            <span className="hidden sm:inline">Coba Lagi</span>
                        </button>
                    )}
                    {loading ? (
                        <GlassButton
                            type="button"
                            variant="danger"
                            size="icon"
                            onClick={onStop}
                            aria-label="Hentikan proses"
                            title="Hentikan"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <rect x="5" y="5" width="14" height="14" rx="2" />
                            </svg>
                        </GlassButton>
                    ) : (
                        <GlassButton
                            type="submit"
                            variant="primary"
                            size="icon"
                            disabled={!question.trim()}
                            aria-label="Kirim"
                            title="Kirim"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </GlassButton>
                    )}
                </div>
            </form>
            {showDisclaimer && (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    Lumina dapat membuat kesalahan. Pastikan untuk memeriksa informasi penting.
                </p>
            )}
        </>
    );
}