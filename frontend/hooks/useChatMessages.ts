"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ChatMessage, Source } from "@/types/chat";

interface UseChatMessagesProps {
    conversationId: number | null;
}

interface UseChatMessagesReturn {
    messages: ChatMessage[];
    loading: boolean;
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useChatMessages({
    conversationId,
}: UseChatMessagesProps): UseChatMessagesReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const loadedConversationRef = useRef<number | null>(null);

    // Handle conversationId changes - clear messages when null, or load new conversation
    useEffect(() => {
        if (!conversationId) {
            // Defer state updates to avoid "setState in effect" warning
            const timer = setTimeout(() => {
                setMessages([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        // Only reload if conversation actually changed
        if (loadedConversationRef.current === conversationId) {
            return;
        }
        loadedConversationRef.current = conversationId;

        setLoading(true);
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
            }>(`/conversations/${conversationId}/messages/`, { timeout: 10000 })
            .then((data) => {
                const loadedMessages: ChatMessage[] = data.messages.map((msg) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    sources: msg.sources ?? [],
                    responseTimeMs: msg.response_time_ms,
                }));
                setMessages(loadedMessages);
            })
            .catch(() => {
                setMessages([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [conversationId]);

    return { messages, loading, setMessages };
}