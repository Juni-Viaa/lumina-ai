"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { api, queriesApi, type StreamEventData } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Source } from "@/types/chat";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { SkeletonChatBubble } from "@/components/ui/Skeleton";

interface ChatMessage {
    id: number;
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
    responseTimeMs?: number;
}

interface DocumentItem {
    id: number;
    document_name: string;
    size_human: string;
    status: string;
}

interface Paginated<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export default function DashboardPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [currentStep, setCurrentStep] = useState<string>("embedding");
    const [stepMessage, setStepMessage] = useState<string>("");
    const [streamedAnswer, setStreamedAnswer] = useState<string>("");
    const lastQuestionRef = useRef<string>("");
    const abortControllerRef = useRef<AbortController | null>(null);
    const currentQueryIdRef = useRef<number | null>(null);
    const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [username] = useState(() => getUser()?.username || "Pengguna");
    const [error, setError] = useState<string | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const activeConversationRef = useRef<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const idCounter = useRef(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        function handleGlobalKeyDown(e: globalThis.KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        }
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, []);

    const loadConversation = useCallback((id: number) => {
        activeConversationRef.current = id;
        setActiveConversationId(id);
        localStorage.setItem("activeConversationId", String(id));
        setMessages([]);
        setQuestion("");
        setError(null);
        setLoading(false);
        setLoadingConversation(true);
        idCounter.current = 0;
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        api
            .get<{
                conversation_id: number;
                messages: {
                    id: number;
                    role: "user" | "assistant";
                    content: string;
                    sources?: Source[];
                    response_time_ms?: number;
                    created_at: string;
                }[];
            }>(`/conversations/${id}/messages/`, { timeout: 10000 })
            .then((data) => {
                const loadedMessages: ChatMessage[] = data.messages.map((msg) => ({
                    id: ++idCounter.current,
                    role: msg.role,
                    content: msg.content,
                    sources: msg.sources ?? [],
                    responseTimeMs: msg.response_time_ms,
                }));
                setMessages(loadedMessages);
            })
            .catch(() => {
                setError("Gagal memuat percakapan.");
                setActiveConversationId(null);
                activeConversationRef.current = null;
                localStorage.removeItem("activeConversationId");
            })
            .finally(() => {
                if (activeConversationRef.current === id) {
                    setLoadingConversation(false);
                }
            });
    }, []);

    useEffect(() => {
        const savedConvId = localStorage.getItem("activeConversationId");
        if (savedConvId) {
            const id = Number(savedConvId);
            if (!isNaN(id) && id > 0) {
                queueMicrotask(() => {
                    loadConversation(id);
                });
            }
        }

        api
            .get<Paginated<DocumentItem>>("/documents/")
            .then((data) => setDocuments(data.results))
            .catch(() => setDocuments([]));
    }, [loadConversation]);

    useEffect(() => {
        function handleNewChat() {
            activeConversationRef.current = null;
            setActiveConversationId(null);
            localStorage.removeItem("activeConversationId");
            setMessages([]);
            setQuestion("");
            setError(null);
            setLoadingConversation(false);
            idCounter.current = 0;
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }

        function handleOpenConversation(e: Event) {
            const detail = (e as CustomEvent<{ id: number }>).detail;
            if (!detail?.id) return;
            loadConversation(detail.id);
        }

        window.addEventListener("lumina:new-chat", handleNewChat);
        window.addEventListener("lumina:open-conversation", handleOpenConversation);
        return () => {
            window.removeEventListener("lumina:new-chat", handleNewChat);
            window.removeEventListener("lumina:open-conversation", handleOpenConversation);
        };
    }, [loadConversation]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    function handleStop() {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (currentQueryIdRef.current) {
            void queriesApi.stop(currentQueryIdRef.current);
            currentQueryIdRef.current = null;
        }
        setLoading(false);
        setStreamedAnswer("");
        setFailedQuestion(lastQuestionRef.current);
        setMessages((prev) => [
            ...prev,
            {
                id: ++idCounter.current,
                role: "assistant",
                content: "⚠️ Proses dihentikan oleh pengguna.",
            },
        ]);
    }

    async function sendMessage(overrideText?: string) {
        const text = (overrideText || question).trim();
        if (!text || loading) return;

        lastQuestionRef.current = text;
        setFailedQuestion(null);
        setError(null);
        setCurrentStep("embedding");
        setStepMessage("Menganalisis pertanyaan…");
        setStreamedAnswer("");

        const userMessage: ChatMessage = {
            id: ++idCounter.current,
            role: "user",
            content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setQuestion("");
        setLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        currentQueryIdRef.current = null;

        try {
            const payload: { question: string; conversation_id?: number } = { question: text };

            if (activeConversationId) {
                payload.conversation_id = activeConversationId;
            }

            let accumulatedText = "";
            let finalSources: Source[] = [];
            let finalResponseTime = 0;
            let finalConvId: number | undefined;

            await api.streamPost("/ask/stream/", {
                body: payload,
                signal: controller.signal,
                onEvent: (event: StreamEventData) => {
                    if (event.type === "init") {
                        if (event.query_id) {
                            currentQueryIdRef.current = event.query_id;
                        }
                        if (event.conversation_id && !activeConversationId) {
                            finalConvId = event.conversation_id;
                        }
                    } else if (event.type === "step") {
                        if (event.step) setCurrentStep(event.step);
                        if (event.message) setStepMessage(event.message);
                    } else if (event.type === "token" && event.token) {
                        accumulatedText += event.token;
                        setStreamedAnswer(accumulatedText);
                    } else if (event.type === "done" && event.data) {
                        const data = event.data;
                        accumulatedText = data.answer || accumulatedText;
                        finalSources = (data.sources as Source[]) || [];
                        finalResponseTime = data.response_time_ms || 0;
                        finalConvId = data.conversation_id;
                    } else if (event.type === "error") {
                        throw new Error(event.message || "Terjadi kesalahan saat memproses pertanyaan.");
                    }
                },
                onDone: () => {
                    if (finalConvId && !activeConversationId) {
                        activeConversationRef.current = finalConvId;
                        setActiveConversationId(finalConvId);
                        localStorage.setItem("activeConversationId", String(finalConvId));
                        window.dispatchEvent(
                            new CustomEvent("lumina:conversation-created", {
                                detail: {
                                    id: finalConvId,
                                    title: text.split(" ").slice(0, 8).join(" ") + (text.length > 8 ? "…" : ""),
                                },
                            })
                        );
                    }

                    const assistantMessage: ChatMessage = {
                        id: ++idCounter.current,
                        role: "assistant",
                        content: accumulatedText,
                        sources: finalSources,
                        responseTimeMs: finalResponseTime,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setStreamedAnswer("");
                    setFailedQuestion(null);
                },
                onError: (err) => {
                    if (controller.signal.aborted) {
                        return;
                    }
                    setFailedQuestion(text);
                    const errMsg = err.message.startsWith("⚠️")
                        ? err.message
                        : `⚠️ ${err.message || "Terjadi kesalahan saat memproses pertanyaan."}`;
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: ++idCounter.current,
                            role: "assistant",
                            content: errMsg,
                        },
                    ]);
                    setStreamedAnswer("");
                },
            });
        } catch (err) {
            if (controller.signal.aborted) {
                return;
            }
            setFailedQuestion(text);
            const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pertanyaan.";
            setMessages((prev) => [
                ...prev,
                {
                    id: ++idCounter.current,
                    role: "assistant",
                    content: errMsg.startsWith("⚠️") ? errMsg : `⚠️ ${errMsg}`,
                },
            ]);
            setStreamedAnswer("");
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setLoading(false);
            }
        }
    }

    function handleRetry() {
        const q = failedQuestion || lastQuestionRef.current;
        if (q) {
            void sendMessage(q);
        }
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Screen reader live region */}
            <div aria-live="polite" aria-atomic="false" className="sr-only">
                {loading
                    ? "Lumina sedang memproses jawaban..."
                    : messages.length > 0 && messages[messages.length - 1].role === "assistant"
                      ? `Lumina menjawab: ${messages[messages.length - 1].content}`
                      : ""}
            </div>

            {/* Chat area */}
            <div className="flex flex-1 flex-col overflow-y-auto">
                {loadingConversation ? (
                    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-5 pt-6 pb-2.5">
                        <SkeletonChatBubble role="assistant" />
                        <SkeletonChatBubble role="user" />
                        <SkeletonChatBubble role="assistant" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                        <div className="flex h-[72px] w-[72px] items-center justify-center">
                            <Image src="/images/icons/Logo.png" width={72} height={72} className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="Lumina" />
                        </div>
                        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-[#0f2436] dark:text-[#f0f6fc]">
                            Halo! Saya <span className="text-[#3b82f6]">Lumina</span>
                        </h1>
                        <p className="mb-6 max-w-[440px] text-[15px] leading-relaxed text-[#334e68] dark:text-[#94a3b8]">
                            Asisten akademikmu. Ajukan pertanyaan dan aku akan menjawabnya sesuai pengetahuanku.
                        </p>

                        {documents.length === 0 && (
                            <p className="mb-6 max-w-md text-xs text-[#3b82f6]/70 dark:text-[#60a5fa]/70">
                                Belum ada dokumen terindeks. Hubungi admin untuk mengunggah dokumen sebelum mengajukan pertanyaan.
                            </p>
                        )}
                        <div className="mx-auto w-full max-w-[820px]">
                            <ChatInput
                                question={question}
                                setQuestion={setQuestion}
                                onSubmit={sendMessage}
                                onStop={handleStop}
                                onRetry={handleRetry}
                                hasRetry={Boolean(failedQuestion)}
                                loading={loading}
                                error={error}
                            />
                        </div>
                    </div>
                ) : (
                    <ChatMessages
                        messages={messages}
                        loading={loading}
                        username={username}
                        currentStep={currentStep}
                        stepMessage={stepMessage}
                        streamedAnswer={streamedAnswer}
                        onRetry={handleRetry}
                    />
                )}
            </div>

            {!loadingConversation && messages.length > 0 && (
                <div className="shrink-0 px-5 pb-5 pt-4">
                    <div className="mx-auto w-full max-w-[820px]">
                        <ChatInput
                            question={question}
                            setQuestion={setQuestion}
                            onSubmit={sendMessage}
                            onStop={handleStop}
                            onRetry={handleRetry}
                            hasRetry={Boolean(failedQuestion)}
                            loading={loading}
                            error={error}
                            showDisclaimer={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}