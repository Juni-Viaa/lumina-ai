"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { ConversationItem } from "@/types/chat";

interface UseConversationsProps {
    initialActiveConv?: number | null;
}

interface UseConversationsReturn {
    conversations: ConversationItem[];
    searchHistory: string;
    setSearchHistory: (value: string) => void;
    activeConv: number | null;
    setActiveConv: (id: number | null) => void;
    handleSelectConversation: (id: number) => void;
    handleNewChat: () => void;
    handleDeleteConversation: (e: React.MouseEvent, id: number) => void;
    groupedConversations?: {
        today: ConversationItem[];
        yesterday: ConversationItem[];
        last7days: ConversationItem[];
        older: ConversationItem[];
    };
}

export function useConversations(
    initialActiveConv?: number | null,
): UseConversationsReturn {
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [searchHistory, setSearchHistory] = useState("");
    const [activeConv, setActiveConv] = useState<number | null>(
        initialActiveConv ?? null,
    );
    const activeConvRef = useRef<number | null>(initialActiveConv ?? null);

    useEffect(() => {
        async function loadInitial() {
            try {
                const data = await api.get<{
                    results: {
                        id: number;
                        title?: string;
                        created_at?: string;
                        query_detail?: { created_at?: string };
                    }[];
                }>("/conversations/");
                const rawList = Array.isArray(data?.results) ? data.results : [];
                const mapped: ConversationItem[] = rawList
                    .slice(0, 30)
                    .map((c) => ({
                        id: c.id,
                        title: c.title || `Percakapan #${c.id}`,
                        createdAt:
                            c.query_detail?.created_at ||
                            c.created_at ||
                            new Date().toISOString(),
                    }));
                setConversations(mapped);
            } catch {
                setConversations([]);
            }
        }

        void loadInitial();
    }, []);

    useEffect(() => {
        function handleNewChat(e: Event) {
            const detail = (e as CustomEvent<{ id: number }>).detail;
            if (detail?.id) {
                activeConvRef.current = detail.id;
                setActiveConv(detail.id);
            }
        }

        function handleOpenConversation(e: Event) {
            const detail = (e as CustomEvent<{ id: number }>).detail;
            if (detail?.id) {
                activeConvRef.current = detail.id;
                setActiveConv(detail.id);
            }
        }

        window.addEventListener("lumina:new-chat", handleNewChat);
        window.addEventListener("lumina:open-conversation", handleOpenConversation);
        return () => {
            window.removeEventListener("lumina:new-chat", handleNewChat);
            window.removeEventListener("lumina:open-conversation", handleOpenConversation);
        };
    }, []);

    useEffect(() => {
        const savedId = typeof window !== "undefined"
            ? localStorage.getItem("activeConversationId")
            : null;
        if (savedId) {
            const id = Number(savedId);
            if (!isNaN(id) && id > 0) {
                activeConvRef.current = id;
            }
        }
    }, []);

    function handleSelectConversation(id: number) {
        activeConvRef.current = id;
        setActiveConv(id);
        if (typeof window !== "undefined") {
            localStorage.setItem("activeConversationId", String(id));
            window.dispatchEvent(
                new CustomEvent("lumina:open-conversation", { detail: { id } }),
            );
        }
    }

    function handleNewChat() {
        activeConvRef.current = null;
        setActiveConv(null);
        if (typeof window !== "undefined") {
            localStorage.removeItem("activeConversationId");
            window.dispatchEvent(new Event("lumina:new-chat"));
        }
    }

    function handleDeleteConversation(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        if (!window.confirm("Hapus percakapan ini dari riwayat?")) return;

        api.delete<void>(`/conversations/${id}/`).then(() => {
            setConversations((prev) => prev.filter((c) => c.id !== id));
        }).catch(() => {
            alert("Gagal menghapus percakapan. Silakan coba lagi.");
        });
    }

    const todayStart = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const grouped = useMemo(() => {
        return {
            today: conversations.filter((c) => {
                if (!c.createdAt) return false;
                const date = new Date(c.createdAt);
                return date >= todayStart;
            }),
            yesterday: conversations.filter((c) => {
                if (!c.createdAt) return false;
                const date = new Date(c.createdAt);
                const yesterdayStart = new Date(todayStart);
                yesterdayStart.setDate(yesterdayStart.getDate() - 1);
                return date >= yesterdayStart && date < todayStart;
            }),
            last7days: conversations.filter((c) => {
                if (!c.createdAt) return false;
                const date = new Date(c.createdAt);
                const last7DaysStart = new Date(todayStart);
                last7DaysStart.setDate(last7DaysStart.getDate() - 7);
                return date >= last7DaysStart && date < todayStart;
            }),
            older: conversations.filter((c) => {
                if (!c.createdAt) return false;
                const date = new Date(c.createdAt);
                return date < todayStart;
            }),
        };
    }, [conversations, todayStart]);

    return {
        conversations,
        searchHistory,
        setSearchHistory,
        activeConv,
        setActiveConv,
        handleSelectConversation,
        handleNewChat,
        handleDeleteConversation,
        groupedConversations: grouped,
    };
}