"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

interface NewChatButtonProps {
    onClose: () => void;
    onNewChat: () => void;
}

export function NewChatButton({ onClose, onNewChat }: NewChatButtonProps) {
    const router = useRouter();

    const handleNewChat = useCallback(() => {
        onNewChat();
        router.push("/");
        onClose();
    }, [onClose, onNewChat, router]);

    return (
        <div className="p-3 pb-2 shrink-0">
            <button
                type="button"
                onClick={handleNewChat}
                className="group relative flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] hover:brightness-105 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
                <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20 text-white">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </span>
                    <span>Chat Baru</span>
                </div>
                <kbd className="hidden sm:inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-sans font-medium tracking-wide text-white/90">
                    ⌘K
                </kbd>
            </button>
        </div>
    );
}