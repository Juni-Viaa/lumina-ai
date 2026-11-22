/**
 * Shared TypeScript interfaces for chat functionality.
 * Used across components, hooks, and API layers.
 */

export interface Source {
    source: string;
    page: number | null;
    score: number | null;
    excerpt: string;
}

export interface ChatMessage {
    id: number;
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
    responseTimeMs?: number;
    createdAt?: string;
}

export interface ConversationItem {
    id: number;
    title: string;
    createdAt: string;
}

export interface ApiConversation {
    id: number;
    title?: string;
    created_at?: string;
    createdAt?: string;
    query_detail?: { created_at?: string };
}

export interface AskResponse {
    success: boolean;
    query_id: number;
    answer_id: number | null;
    answer: string;
    response_time_ms: number;
    sources: Source[];
    conversation_id?: number;
}

export interface ConversationMessagesResponse {
    conversation_id: number;
    messages: {
        id: number;
        role: "user" | "assistant";
        content: string;
        sources?: Source[];
        response_time_ms?: number;
        created_at: string;
    }[];
}

export interface Paginated<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface DocumentItem {
    id: number;
    document_name: string;
    size: number;
    file_type: string;
    status: string;
    is_ocr: boolean;
    size_human?: string;
}