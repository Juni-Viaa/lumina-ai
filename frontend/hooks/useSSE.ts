"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

export interface DocumentStatsData {
    total: number;
    indexed: number;
    processing: number;
    failed: number;
}

export interface DocStatusData {
    id: number;
    document_name: string;
    status: string;
    size?: number;
    file_type?: string;
    is_ocr?: boolean;
}

interface UseSSEOptions {
    enabled?: boolean;
    onStats?: (stats: DocumentStatsData) => void;
    onDocStatus?: (doc: DocStatusData) => void;
    onError?: (error: unknown) => void;
}

// ponytail: native browser EventSource for GET streams with cookie auth. Upgrade to fetch-event-source if custom auth headers are needed.
export function useDocumentSSE({
    enabled = true,
    onStats,
    onDocStatus,
    onError,
}: UseSSEOptions = {}) {
    const onStatsRef = useRef(onStats);
    const onDocStatusRef = useRef(onDocStatus);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onStatsRef.current = onStats;
        onDocStatusRef.current = onDocStatus;
        onErrorRef.current = onError;
    }, [onStats, onDocStatus, onError]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        let es: EventSource | null = null;
        let retryTimeout: NodeJS.Timeout | null = null;
        let isClosed = false;

        function connect() {
            if (isClosed) return;
            try {
                const url = api.getEventSourceUrl("/documents/stream/");
                es = new EventSource(url, { withCredentials: true });

                es.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.type === "stats" && onStatsRef.current) {
                            onStatsRef.current(payload.data);
                        } else if (payload.type === "doc_status" && onDocStatusRef.current) {
                            onDocStatusRef.current(payload.data);
                        }
                    } catch {
                        // ignore heartbeat or non-json message
                    }
                };

                es.onerror = (err) => {
                    es?.close();
                    es = null;
                    onErrorRef.current?.(err);
                    if (!isClosed) {
                        retryTimeout = setTimeout(connect, 4000);
                    }
                };
            } catch (err) {
                onErrorRef.current?.(err);
                if (!isClosed) {
                    retryTimeout = setTimeout(connect, 4000);
                }
            }
        }

        connect();

        return () => {
            isClosed = true;
            if (retryTimeout) clearTimeout(retryTimeout);
            if (es) es.close();
        };
    }, [enabled]);
}
