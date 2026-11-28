"use client";

import { useRef, useEffect } from "react";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { ChatProgressIndicator } from "./ChatProgressIndicator";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types/chat";

interface ChatMessagesProps {
    messages: ChatMessage[];
    loading: boolean;
    username: string;
    currentStep?: string;
    stepMessage?: string;
    streamedAnswer?: string;
    onRetry?: () => void;
    className?: string;
}

export function ChatMessages({
    messages,
    loading,
    username,
    currentStep,
    stepMessage,
    streamedAnswer,
    onRetry,
    className,
}: ChatMessagesProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
            if (isNearBottom || loading) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }
    }, [messages, loading, streamedAnswer, currentStep]);

    return (
        <div
            ref={scrollRef}
            className={cn(
                "mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 sm:px-5 pt-4 sm:pt-6 pb-2.5",
                className,
            )}
        >
            {messages.map((msg, index) => {
                const isLast = index === messages.length - 1;
                return (
                    <ChatBubble
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        username={username}
                        sources={msg.sources}
                        responseTimeMs={msg.responseTimeMs}
                        onRetry={isLast ? onRetry : undefined}
                        className="animate-message-enter"
                    />
                );
            })}

            {loading && (
                <ChatProgressIndicator
                    currentStep={currentStep}
                    stepMessage={stepMessage}
                    streamedAnswer={streamedAnswer}
                />
            )}
        </div>
    );
}