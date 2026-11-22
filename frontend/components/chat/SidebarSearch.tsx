"use client";

import { useState } from "react";
import { ConversationItem } from "@/types/chat";

interface SidebarSearchProps {
    conversations: ConversationItem[];
    setSearchResults: (results: ConversationItem[]) => void;
    searchHistory: string;
    setSearchHistory: (value: string) => void;
}

export function SidebarSearch({
    conversations,
    setSearchResults,
    searchHistory,
    setSearchHistory,
}: SidebarSearchProps) {
    const [localSearchHistory, setLocalSearchHistory] = useState(searchHistory);

    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        setLocalSearchHistory(e.target.value);
    }

    function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSearchHistory(localSearchHistory);
        setLocalSearchHistory("");
    }

    return (
        <div className="relative flex items-center rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 px-2.5 py-1.5 text-xs transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <svg className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <form onSubmit={handleSearchSubmit} className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-600 dark:placeholder:text-slate-400 outline-none">
                <input
                    type="text"
                    value={localSearchHistory}
                    onChange={handleSearchChange}
                    placeholder="Cari riwayat..."
                    aria-label="Cari riwayat percakapan"
                    className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-600 dark:placeholder:text-slate-400 outline-none"
                />
            </form>
            {localSearchHistory && (
                <button
                    type="button"
                    onClick={() => setLocalSearchHistory("")}
                    aria-label="Hapus pencarian"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}