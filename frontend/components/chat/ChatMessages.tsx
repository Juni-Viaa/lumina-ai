"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types/chat";

interface ChatMessagesProps {
    messages: ChatMessage[];
    loading: boolean;
    username: string;
    className?: string;
}

export function ChatMessages({
    messages,
    loading,
    username,
    className,
}: ChatMessagesProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    return (
        <div
            ref={scrollRef}
            className={cn(
                "mx-auto flex w-full max-w-[820px] flex-col gap-5 px-5 pt-6 pb-2.5",
                className,
            )}
        >
            {messages.map((msg) => (
                <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    username={username}
                    sources={msg.sources}
                    responseTimeMs={msg.responseTimeMs}
                    className="animate-message-enter"
                />
            ))}

            {loading && (
                <div className="flex gap-3.5 animate-message-enter">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2563eb]/30 bg-white/50 dark:bg-slate-800/60 overflow-hidden">
                        <Image
                            src="/images/icons/Logo.png"
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] object-contain"
                            alt="Lumina"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[13px] font-semibold text-[#0f2436] dark:text-[#94a3b8]">
                            Lumina
                        </div>
                        <div className="flex gap-[5px] py-2">
                            <span className="typing-dot h-2 w-2 rounded-full bg-[#3b82f6]" />
                            <span className="typing-dot h-2 w-2 rounded-full bg-[#3b82f6]" />
                            <span className="typing-dot h-2 w-2 rounded-full bg-[#3b82f6]" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}