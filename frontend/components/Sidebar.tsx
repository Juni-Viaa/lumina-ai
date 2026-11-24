"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import { api } from "@/lib/api";
import { getUser, logout } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

import { NewChatButton } from "@/components/chat/NewChatButton";
import { SidebarNav } from "@/components/chat/SidebarNav";
import { SidebarSearch } from "@/components/chat/SidebarSearch";

interface SidebarProps {
    onClose: () => void;
}

interface ConversationItem {
    id: number;
    title: string;
    createdAt: string;
}

interface ApiConversation {
    id: number;
    title?: string;
    created_at?: string;
    query_detail?: { created_at?: string };
}

function getDateGroup(iso?: string): "today" | "yesterday" | "last7days" | "older" {
    if (!iso) return "older";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "older";

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);

    if (date >= todayStart) return "today";
    if (date >= yesterdayStart) return "yesterday";
    if (date >= last7DaysStart) return "last7days";
    return "older";
}

function subscribeActiveConversation(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener("lumina:open-conversation", callback);
    window.addEventListener("lumina:conversation-created", callback);
    window.addEventListener("lumina:new-chat", callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("lumina:open-conversation", callback);
        window.removeEventListener("lumina:conversation-created", callback);
        window.removeEventListener("lumina:new-chat", callback);
    };
}

function getActiveConversationSnapshot(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem("activeConversationId") : null;
}

function getServerActiveConversationSnapshot(): string | null {
    return null;
}

function subscribeNewConversation(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener("lumina:conversation-created", callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("lumina:conversation-created", callback);
    };
}

function getNewConversationSnapshot(): number | null {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("newConversationId");
    return saved ? Number(saved) : null;
}

function getServerNewConversationSnapshot(): number | null {
    return null;
}

export default function Sidebar({ onClose }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const user = getUser();
    const isAdmin = user?.role === "admin" && user?.is_staff === true;
    const { setTheme } = useTheme();
    const toast = useToast();

    const [accountOpen, setAccountOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const activeConvStr = useSyncExternalStore(
        subscribeActiveConversation,
        getActiveConversationSnapshot,
        getServerActiveConversationSnapshot
    );
    const activeConversationId = activeConvStr ? Number(activeConvStr) : null;
    const newConversationId = useSyncExternalStore(
        subscribeNewConversation,
        getNewConversationSnapshot,
        getServerNewConversationSnapshot
    );
    const [searchHistory, setSearchHistory] = useState("");
    const [searchResults, setSearchResults] = useState<ConversationItem[]>([]);

    const accountRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLButtonElement>(null);

    const fetchConversations = useCallback(
        async (q: string = "") => {
            try {
                const url = q
                    ? `/conversations/search/?q=${encodeURIComponent(q)}`
                    : "/conversations/";

                const data = await api.get<{ results: ApiConversation[] }>(url);
                const rawList = Array.isArray(data?.results) ? data.results : [];

                if (!q) {
                    const mapped: ConversationItem[] = rawList
                        .slice(0, 30)
                        .map((c) => ({
                            id: c.id,
                            title: c.title || `Percakapan #${c.id}`,
                            createdAt:
                                c.query_detail?.created_at || c.created_at || new Date().toISOString(),
                        }));
                    setConversations(mapped);
                } else {
                    const mapped: ConversationItem[] = rawList.map((c) => ({
                        id: c.id,
                        title: c.title || `Percakapan #${c.id}`,
                        createdAt: c.created_at || c.query_detail?.created_at || new Date().toISOString(),
                    }));
                    setSearchResults(mapped);
                }
            } catch {
                if (!q) setConversations([]);
            }
        },
        []
    );

    // Initial load and sync with conversation events
    useEffect(() => {
        let ignore = false;

        async function loadInitial() {
            try {
                const data = await api.get<{ results: ApiConversation[] }>("/conversations/");
                if (!ignore) {
                    const rawList = Array.isArray(data?.results) ? data.results : [];
                    const mapped: ConversationItem[] = rawList
                        .slice(0, 30)
                        .map((c) => ({
                            id: c.id,
                            title: c.title || `Percakapan #${c.id}`,
                            createdAt: c.query_detail?.created_at || c.created_at || new Date().toISOString(),
                        }));
                    setConversations(mapped);
                }
            } catch {
                if (!ignore) setConversations([]);
            }
        }

        void loadInitial();

        function handleConversationCreated(e: Event) {
            const detail = (e as CustomEvent<{ id: number; title: string }>).detail;
            if (detail?.id) {
                localStorage.setItem("newConversationId", String(detail.id));
                window.dispatchEvent(new Event("storage"));
                void fetchConversations();
            }
        }

        window.addEventListener("lumina:conversation-created", handleConversationCreated);

        return () => {
            ignore = true;
            window.removeEventListener("lumina:conversation-created", handleConversationCreated);
        };
    }, [fetchConversations]);

    // Debounced search
    useEffect(() => {
        if (!searchHistory.trim()) return;

        const timer = setTimeout(() => {
            void fetchConversations(searchHistory);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchHistory, fetchConversations]);

    // Close account popover on outside click or Escape
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                accountRef.current &&
                !accountRef.current.contains(e.target as Node) &&
                !profileRef.current?.contains(e.target as Node)
            ) {
                setAccountOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setAccountOpen(false);
            }
        }
        if (accountOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleKeyDown);
            };
        }
    }, [accountOpen]);

    const handleNewChat = useCallback(() => {
        localStorage.removeItem("newConversationId");
        localStorage.removeItem("activeConversationId");
        window.dispatchEvent(new Event("lumina:new-chat"));
        router.push("/");
        onClose();
    }, [router, onClose]);

    // Keyboard shortcut: Ctrl+K / Cmd+K for New Chat
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                const target = e.target as HTMLElement | null;
                const tag = target?.tagName.toLowerCase();
                if (tag !== "input" && tag !== "textarea") {
                    e.preventDefault();
                    handleNewChat();
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNewChat]);

    const handleSelectConversation = useCallback((id: number) => {
        localStorage.setItem("activeConversationId", String(id));
        window.dispatchEvent(
            new CustomEvent("lumina:open-conversation", { detail: { id } })
        );
        if (pathname !== "/") {
            router.push("/");
        }
        onClose();
    }, [pathname, router, onClose]);

    const handleDeleteConversation = useCallback((e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!confirmDeleteId) return;
        setIsDeleting(true);
        try {
            await api.delete(`/conversations/${confirmDeleteId}/`);
            setConversations((prev) => prev.filter((c) => c.id !== confirmDeleteId));
            setSearchResults((prev) => prev.filter((c) => c.id !== confirmDeleteId));

            if (activeConversationId === confirmDeleteId) {
                handleNewChat();
            }
            toast.success("Percakapan berhasil dihapus");
        } catch {
            toast.error("Gagal menghapus percakapan. Silakan coba lagi.");
        } finally {
            setIsDeleting(false);
            setConfirmDeleteId(null);
        }
    }, [confirmDeleteId, activeConversationId, handleNewChat, toast]);

    function handleLogout() {
        logout();
        setAccountOpen(false);
        router.push("/login");
        onClose();
    }

    function handleChangePassword() {
        setAccountOpen(false);
        router.push("/change-password");
        onClose();
    }

    const renderConversations = useMemo(() => {
        // When searching
        if (searchHistory.trim()) {
            if (searchResults.length === 0) {
                return (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <svg
                            className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Tidak ada hasil ditemukan
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Coba kata kunci lain
                        </p>
                    </div>
                );
            }
            return (
                <div className="space-y-0.5">
                    {searchResults.map((c) => {
                        const isActive = c.id === activeConversationId;
                        const isNew = c.id === newConversationId;
                        return (
                            <div
                                key={c.id}
                                className={`relative flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${isActive
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/30 dark:border-blue-500/30"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/50"} ${isNew ? "ring-2 ring-emerald-500/50" : ""}`}
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => handleSelectConversation(c.id)}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <svg
                                        className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.502 49.188 49.188 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                                        />
                                    </svg>
                                    <span className="truncate">{c.title}</span>
                                </div>
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-opacity shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteConversation(e, c.id);
                                    }}
                                    title="Hapus percakapan"
                                    aria-label={`Hapus ${c.title}`}
                                >
                                    <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09 2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                        />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Group conversations by date
        const grouped: Record<string, ConversationItem[]> = {
            today: [],
            yesterday: [],
            last7days: [],
            older: [],
        };

        conversations.forEach((c) => {
            const group = getDateGroup(c.createdAt);
            grouped[group].push(c);
        });

        if (conversations.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <svg
                        className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Belum ada riwayat percakapan
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Mulai chat baru untuk memulai
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {[

                    { key: "today", label: "Hari Ini" },
                    { key: "yesterday", label: "Kemarin" },
                    { key: "last7days", label: "7 Hari Terakhir" },
                    { key: "older", label: "Lebih Lama" },

                ].map(({ key, label }) => {
                    const items = grouped[key as keyof typeof grouped];
                    if (items.length === 0) return null;
                    return (
                        <div key={key} className="space-y-1">
                            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {label}
                            </div>
                            {items.map((c) => {
                                const isActive = c.id === activeConversationId;
                                const isNew = c.id === newConversationId;
                                return (
                                    <div
                                        key={c.id}
                                        className={`group relative flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${isActive
                                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/30 dark:border-blue-500/30"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/50"} ${isNew ? "ring-2 ring-emerald-500/50" : ""}`}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={() => handleSelectConversation(c.id)}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <svg
                                                className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={1.75}
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.502 49.188 49.188 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                                                />
                                            </svg>
                                            <span className="truncate">{c.title}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-opacity shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteConversation(e, c.id);
                                            }}
                                            title="Hapus percakapan"
                                            aria-label={`Hapus ${c.title}`}
                                        >
                                            <svg
                                                className="h-3.5 w-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09 2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }, [searchHistory, searchResults, conversations, activeConversationId, newConversationId, handleDeleteConversation, handleSelectConversation]);

    return (
        <aside
            id="app-sidebar"
            aria-label="Sidebar Navigasi"
            className={`flex flex-col h-full w-[260px] shrink-0 rounded-xl border border-slate-200/60 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl`}
        >
            <div className="flex h-16 items-center justify-between border-b border-white/40 dark:border-slate-800/60 px-4 shrink-0">
                <Link
                    href="/"
                    className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                    onClick={() => {
                        handleNewChat();
                        onClose();
                    }}
                >
                    <div
                        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20 p-1 border border-blue-500/20"
                    >
                        <Image
                            src="/images/icons/Logo.png"
                            width={32}
                            height={32}
                            className="h-full w-full object-contain"
                            alt="Logo Lumina"
                        />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 leading-none">
                            <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                Lumi<span className="text-blue-600 dark:text-blue-400">na</span>
                            </span>
                            <span className="rounded-full bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                RAG
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            AI Document Assistant
                        </span>
                    </div>
                </Link>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup menu navigasi"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors md:hidden"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <NewChatButton onClose={onClose} onNewChat={handleNewChat} />

            <SidebarNav pathname={pathname} onClose={onClose} />

            <div className="px-3 pt-3 pb-1 shrink-0">
                <div className="flex items-center justify-between px-1 pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Riwayat Percakapan
                    </span>
                    {conversations.length > 0 && (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            {conversations.length}
                        </span>
                    )}
                </div>

                <SidebarSearch
                    conversations={conversations}
                    setSearchResults={setSearchResults}
                    searchHistory={searchHistory}
                    setSearchHistory={setSearchHistory}
                />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                {renderConversations}
            </div>

            <div
                ref={accountRef}
                className="relative border-t border-slate-200/70 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shrink-0"
            >
                {accountOpen && (
                    <div
                        className="absolute bottom-full left-3 right-3 mb-2 z-50 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-xl"
                    >
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {user?.username || "Pengguna Lumina"}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                                Role: {user?.role || "Member"} {isAdmin && "• Staff Admin"}
                            </p>
                        </div>

                        <div className="px-2 py-1 space-y-1">
                            <button
                                type="button"
                                onClick={handleChangePassword}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1.17.43-1.563A6 6 0 1 1 21.75 8.25Z" />
                                </svg>
                                <span>Ubah Kata Sandi</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                </svg>
                                <span>Keluar</span>
                            </button>
                        </div>

                        <div className="px-2 py-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                                Tema Tampilan
                            </span>
                            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 p-1 text-[11px] font-medium">
                                <button
                                    type="button"
                                    onClick={() => setTheme("light")}
                                    className="flex items-center justify-center gap-1.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                                    </svg>
                                    <span>Terang</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme("dark")}
                                    className="flex items-center justify-center gap-1.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                                    </svg>
                                    <span>Gelap</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme("system")}
                                    className="flex items-center justify-center gap-1.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
                                    </svg>
                                    <span>Sistem</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    ref={profileRef}
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                    aria-expanded={accountOpen}
                    aria-label="Menu akun pengguna"
                >
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-xs">
                        {user?.username?.slice(0, 1).toUpperCase() || "U"}
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {user?.username || "Pengguna"}
                        </span>
                        <span className="block truncate text-[10px] text-slate-600 dark:text-slate-400 capitalize">
                            {user?.role || "Member"} {isAdmin && "• Admin"}
                        </span>
                    </div>

                    <svg
                        className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${accountOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
            </div>

            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                title="Hapus Percakapan"
                description="Apakah Anda yakin ingin menghapus percakapan ini dari riwayat? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="danger"
                loading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </aside>
    );
}