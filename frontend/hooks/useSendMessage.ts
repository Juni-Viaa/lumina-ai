"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Source, AskResponse, ChatMessage } from "@/types/chat";

interface UseSendMessageProps {
    activeConversationId: number | null;
    setActiveConversationId: (id: number | null) => void;
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

interface UseSendMessageReturn {
    sendMessage: (question: string) => Promise<void>;
    isSending: boolean;
    lastAnswer: string | null;
    setLastAnswer: (answer: string | null) => void;
}

export function useSendMessage(
    activeConversationId: number | null,
    setActiveConversationId: (id: number | null) => void,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): UseSendMessageReturn {
    const [isSending, setIsSending] = useState(false);
    const [lastAnswer, setLastAnswer] = useState<string | null>(null);
    const activeConversationRef = useRef<number | null>(activeConversationId);
    const idCounter = useRef(0);

    activeConversationRef.current = activeConversationId;

    const sendMessage = useCallback(
        async (question: string) => {
            const text = question.trim();
            if (!text || isSending) return;

            setIsSending(true);

            // Optimistic user message
            const userMessage: ChatMessage = {
                id: ++idCounter.current,
                role: "user",
                content: text,
            };
            setMessages((prev) => [...prev, userMessage]);

            try {
                const payload: { question: string; conversation_id?: number } = { question: text };

                if (activeConversationRef.current) {
                    payload.conversation_id = activeConversationRef.current;
                }

                const data = await api.post<AskResponse>("/ask/", payload);

                if (data.conversation_id && !activeConversationRef.current) {
                    activeConversationRef.current = data.conversation_id;
                    setActiveConversationId(data.conversation_id);
                    if (typeof window !== "undefined") {
                        localStorage.setItem("activeConversationId", String(data.conversation_id));
                        window.dispatchEvent(
                            new CustomEvent("lumina:conversation-created", {
                                detail: {
                                    id: data.conversation_id,
                                    title: text.split(" ").slice(0, 8).join(" ") + (text.length > 8 ? "…" : ""),
                                },
                            })
                        );
                    }
                }

                const assistantMessage: ChatMessage = {
                    id: ++idCounter.current,
                    role: "assistant",
                    content: data.answer,
                    sources: data.sources ?? [],
                    responseTimeMs: data.response_time_ms,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setLastAnswer(data.answer);
            } catch (err) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: ++idCounter.current,
                        role: "assistant",
                        content:
                            err instanceof Error
                                ? `⚠️ ${err.message}`
                                : "⚠️ Terjadi kesalahan saat memproses pertanyaan.",
                    },
                ]);
            } finally {
                setIsSending(false);
            }
        },
        [isSending, setActiveConversationId, setMessages],
    );

    return {
        sendMessage,
        isSending,
        lastAnswer,
        setLastAnswer,
    };
}