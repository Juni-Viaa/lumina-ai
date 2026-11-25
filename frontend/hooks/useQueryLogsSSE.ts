"use client";

import { useEffect, useRef } from "react";
import { monitoringApi } from "@/lib/api";
import type { QueryLogItem } from "@/types/monitoring";

interface UseQueryLogsSSEOptions {
    enabled?: boolean;
    onNewLog?: (log: QueryLogItem) => void;
    onError?: (error: unknown) => void;
}

export function useQueryLogsSSE({
    enabled = true,
    onNewLog,
    onError,
}: UseQueryLogsSSEOptions = {}) {
    const onNewLogRef = useRef(onNewLog);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onNewLogRef.current = onNewLog;
        onErrorRef.current = onError;
    }, [onNewLog, onError]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        let es: EventSource | null = null;
        let retryTimeout: NodeJS.Timeout | null = null;
        let isClosed = false;

        function connect() {
            if (isClosed) return;
            try {
                const url = monitoringApi.getQueryLogsStreamUrl();
                es = new EventSource(url, { withCredentials: true });

                es.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.type === "new_log" && payload.data && onNewLogRef.current) {
                            onNewLogRef.current(payload.data);
                        }
                    } catch {
                        // ignore heartbeat or invalid payload
                    }
                };

                es.onerror = (err) => {
                    es?.close();
                    es = null;
                    onErrorRef.current?.(err);
                    if (!isClosed) {
                        retryTimeout = setTimeout(connect, 3000);
                    }
                };
            } catch (err) {
                onErrorRef.current?.(err);
                if (!isClosed) {
                    retryTimeout = setTimeout(connect, 3000);
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
