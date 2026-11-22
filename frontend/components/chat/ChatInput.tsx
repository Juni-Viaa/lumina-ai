"use client";

import { useRef } from "react";
import { GlassButton } from "@/components/ui/GlassButton";

interface ChatInputProps {
    question: string;
    setQuestion: (value: string) => void;
    onSubmit: () => void;
    loading: boolean;
    error?: string | null;
    showDisclaimer?: boolean;
}

export function ChatInput({
    question,
    setQuestion,
    onSubmit,
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
        onSubmit();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
        }
    }

    return (
        <>
            {error && <p className="mb-1 text-xs text-red-500">{error}</p>}
            <form onSubmit={handleSubmit} className="glass-input flex items-center gap-2.5 rounded-3xl px-5 py-2">
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
                    <GlassButton
                        type="submit"
                        variant="primary"
                        size="icon"
                        disabled={loading || !question.trim()}
                        aria-label="Kirim"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </GlassButton>
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