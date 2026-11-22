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
}

// ponytail: memoized bubble with local copy state. Upgrade to global toast notification if toasts are implemented across the app.
export const ChatBubble = memo(function ChatBubble({
    role,
    content,
    username = "Pengguna",
    sources,
    responseTimeMs,
    className,
}: ChatBubbleProps) {
    const [copied, setCopied] = useState(false);
    const isAssistant = role === "assistant";

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
                        <div className="glass-card px-4 py-3 text-[14px] leading-relaxed text-[#0f2436] dark:text-[#f0f6fc]">
                            <Markdown content={content} />
                        </div>

                        {/* Citations / Sources */}
                        {sources && sources.length > 0 && (
                            <details className="group/details mt-2 text-xs">
                                <summary className="cursor-pointer font-medium text-[#2563eb] dark:text-[#60a5fa] hover:underline focus:outline-none focus:ring-1 focus:ring-[#2563eb] rounded inline-flex items-center gap-1.5 py-1">
                                    <span>Lihat {sources.length} sumber referensi</span>
                                    <span className="text-[10px] transition-transform group-open/details:rotate-180">▼</span>
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
                        <div className="flex items-center gap-2 pt-0.5">
                            <button
                                type="button"
                                onClick={handleCopy}
                                aria-label={copied ? "Teks disalin" : "Salin pesan"}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#2563eb] dark:text-[#60a5fa] hover:bg-blue-500/10 transition-colors"
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
