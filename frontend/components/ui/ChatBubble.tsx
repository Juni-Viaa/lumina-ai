"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Markdown from "@/components/Markdown";
import { cn } from "@/lib/utils";

export interface Source {
    source: string;
    page: number | null;
    score: number | null;
    excerpt: string;
}

export interface ChatBubbleProps {
    role: "user" | "assistant";
    content: string;
    username?: string;
    sources?: Source[];
    responseTimeMs?: number;
    className?: string;
    isError?: boolean;
    onRetry?: () => void;
}

// ponytail: memoized bubble with copy feedback. Upgrade to global toast notification if toasts are implemented across the app.
export const ChatBubble = memo(function ChatBubble({
    role,
    content,
    username = "Pengguna",
    sources,
    responseTimeMs,
    className,
    isError = false,
    onRetry,
}: ChatBubbleProps) {
    const [copied, setCopied] = useState(false);
    const isAssistant = role === "assistant";
    const hasError = isError || (isAssistant && (content.startsWith("⚠️") || content.startsWith("Terjadi kesalahan")));
    const displayContent = content.replace(/^⚠️\s*/, "");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access denied / fallback
        }
    };

    return (
        <div
            className={cn(
                "group flex gap-3.5",
                isAssistant ? "flex-row" : "flex-row-reverse text-right",
                className,
            )}
            role="article"
            aria-label={`Pesan dari ${isAssistant ? "Lumina" : username}`}
        >
            {/* Avatar */}
            {isAssistant ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2563eb]/30 bg-white/50 dark:bg-slate-800/60 shadow-sm">
                    <Image
                        src="/images/icons/Logo.png"
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                        alt="Lumina"
                    />
                </div>
            ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#1d4ed8] text-[13px] font-semibold text-white shadow-sm">
                    {username.slice(0, 1).toUpperCase()}
                </div>
            )}

            {/* Content area */}
            <div className={cn("min-w-0 flex-1", !isAssistant && "flex flex-col items-end")}>
                <div className="mb-1 text-xs font-semibold text-[#0f2436] dark:text-[#94a3b8]">
                    {isAssistant ? "Lumina" : username}
                </div>

                {isAssistant ? (
                    <div className="space-y-3 text-left">
                        {hasError ? (
                            <div className="flex items-start gap-3 rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-3.5 text-xs text-rose-800 dark:text-rose-200">
                                <svg className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                </svg>
                                <div className="flex-1 space-y-2">
                                    <p className="leading-relaxed">{displayContent}</p>
                                    {onRetry && (
                                        <button
                                            type="button"
                                            onClick={onRetry}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 dark:bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors cursor-pointer"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                            </svg>
                                            <span>Coba Lagi</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card px-4 py-3 text-[14px] leading-relaxed text-[#0f2436] dark:text-[#f0f6fc]">
                                <Markdown content={content} />
                            </div>
                        )}

                        {/* Citations / Sources */}
                        {sources && sources.length > 0 && (
                            <details className="group/details mt-2 text-xs">
                                <summary className="cursor-pointer font-medium text-[#2563eb] dark:text-[#60a5fa] hover:underline focus:outline-none focus:ring-1 focus:ring-[#2563eb] rounded inline-flex items-center gap-1.5 py-1">
                                    <span>Lihat {sources.length} sumber referensi</span>
                                    <svg className="h-3 w-3 transition-transform group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </summary>
                                <div className="mt-2 space-y-2">
                                    {sources.map((s, idx) => (
                                        <div
                                            key={idx}
                                            className="glass-inner rounded-xl p-3 border border-white/30 dark:border-blue-900/40 text-xs"
                                        >
                                            <div className="flex items-center justify-between font-semibold text-[#0f2436] dark:text-[#93c5fd]">
                                                <span>{s.source}</span>
                                                {s.page != null && (
                                                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                                        Halaman {s.page}
                                                    </span>
                                                )}
                                            </div>
                                            {s.excerpt && (
                                                <p className="mt-1 line-clamp-3 text-slate-600 dark:text-slate-300 leading-normal">
                                                    {s.excerpt}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* Actions bar: Copy & Response time */}
                        {!hasError && (
                            <div className="flex items-center gap-2 pt-0.5">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    aria-label={copied ? "Teks disalin" : "Salin pesan"}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#2563eb] dark:text-[#60a5fa] hover:bg-blue-500/10 transition-colors cursor-pointer"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    >
                                        {copied ? (
                                            <polyline points="20 6 9 17 4 12" />
                                        ) : (
                                            <>
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </>
                                        )}
                                    </svg>
                                    <span>{copied ? "Disalin!" : "Salin"}</span>
                                </button>

                                {responseTimeMs !== undefined && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {(responseTimeMs / 1000).toFixed(2)} s
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="inline-block max-w-[85%] rounded-[18px_6px_18px_18px] bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] px-4 py-3 text-left text-[14px] leading-relaxed text-white shadow-md">
                        <span className="whitespace-pre-wrap break-words">{content}</span>
                    </div>
                )}
            </div>
        </div>
    );
});
