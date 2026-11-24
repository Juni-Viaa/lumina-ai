"use client";

import Image from "next/image";
import Markdown from "@/components/Markdown";

export type RagStep = "embedding" | "retrieval" | "reranking" | "generating" | "done";

export interface ChatProgressIndicatorProps {
    currentStep?: RagStep | string;
    stepMessage?: string;
    streamedAnswer?: string;
}

const STEPS: { key: RagStep; label: string }[] = [
    { key: "embedding", label: "Analisis Pertanyaan" },
    { key: "retrieval", label: "Pencarian Dokumen" },
    { key: "reranking", label: "Penyaringan Konteks" },
    { key: "generating", label: "Generasi Jawaban" },
];

const STEP_TRANSLATIONS: Record<string, string> = {
    embedding: "Menganalisis pertanyaan...",
    retrieval: "Mencari dokumen relevan...",
    similarity_search: "Mencari dokumen relevan...",
    reranking: "Menyaring referensi terbaik...",
    context: "Menyusun konteks dokumen...",
    generating: "AI sedang menghasilkan jawaban...",
    generate: "AI sedang menghasilkan jawaban...",
    done: "Selesai",
};

const MESSAGE_TRANSLATIONS: Record<string, string> = {
    "Embedding query...": "Menganalisis pertanyaan...",
    "Retrieve context...": "Mencari dokumen relevan...",
    "Reranking context...": "Menyaring referensi terbaik...",
    "AI generating answer...": "AI sedang menghasilkan jawaban...",
};

function getStepIndex(step?: string): number {
    switch (step) {
        case "embedding":
            return 0;
        case "retrieval":
        case "similarity_search":
            return 1;
        case "reranking":
            return 2;
        case "generating":
        case "context":
        case "generate":
            return 3;
        case "done":
            return 4;
        default:
            return 0;
    }
}

function getLocalizedMessage(step?: string, message?: string): string {
    if (message && MESSAGE_TRANSLATIONS[message]) {
        return MESSAGE_TRANSLATIONS[message];
    }
    if (step && STEP_TRANSLATIONS[step]) {
        return STEP_TRANSLATIONS[step];
    }
    return message || "Sedang memproses...";
}

// ponytail: static 4-stage pipeline indicators with real-time token preview. Upgrade to dynamic DAG visualisation if pipeline steps are extended (e.g. web search, vision OCR preview).
export function ChatProgressIndicator({
    currentStep = "embedding",
    stepMessage,
    streamedAnswer,
}: ChatProgressIndicatorProps) {
    const currentIndex = getStepIndex(currentStep);
    const displayMessage = getLocalizedMessage(currentStep, stepMessage);

    return (
        <div className="flex gap-3.5 animate-message-enter" role="status" aria-live="polite">
            {/* Lumina Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-500/30 bg-white/50 dark:bg-slate-800/60 shadow-sm">
                <Image
                    src="/images/icons/Logo.png"
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                    alt="Lumina"
                />
            </div>

            <div className="min-w-0 flex-1 space-y-2">
                <div className="text-xs font-semibold text-[#0f2436] dark:text-[#94a3b8]">
                    Lumina
                </div>

                {/* Real-time Stage Progression Pill */}
                <div className="glass-inner inline-flex flex-col gap-1.5 rounded-xl border border-blue-500/20 bg-white/40 dark:bg-slate-800/40 p-2.5 shadow-xs">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                        </span>
                        <span className="text-[11px] font-semibold tracking-wide text-blue-700 dark:text-blue-300">
                            {displayMessage}
                        </span>
                    </div>

                    {/* Step progression breadcrumbs */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                        {STEPS.map((s, idx) => {
                            const isDone = currentIndex > idx;
                            const isCurrent = currentIndex === idx;
                            return (
                                <div key={s.key} className="flex items-center gap-1">
                                    <span
                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                            isDone
                                                ? "w-4 bg-emerald-500"
                                                : isCurrent
                                                  ? "w-6 bg-blue-500 animate-pulse"
                                                  : "w-2 bg-slate-300 dark:bg-slate-700"
                                        }`}
                                        title={s.label}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Streaming answer text preview if tokens started arriving */}
                {streamedAnswer && (
                    <div className="glass-card px-4 py-3 text-[14px] leading-relaxed text-[#0f2436] dark:text-[#f0f6fc]">
                        <Markdown content={streamedAnswer} />
                        <span className="inline-block h-3.5 w-1.5 ml-1 bg-blue-500 animate-pulse align-middle" />
                    </div>
                )}
            </div>
        </div>
    );
}
