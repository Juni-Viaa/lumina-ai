/**
 * API client terpusat untuk semua komunikasi dengan backend Django.
 * Jangan sebar `fetch()` langsung di komponen — selalu lewat layer ini.
 * Backend sekarang menggunakan HttpOnly cookie authentication.
 */

import { clearAuth, getCsrfToken } from "./auth";
import type { ChartsData, MyTokenUsage, PaginatedQueryLogs, TokenSummary } from "@/types/monitoring";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const DEFAULT_TIMEOUT_MS = 60000;

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: unknown;
    /** When true, body is a FormData and Content-Type is left to the browser. */
    isFormData?: boolean;
    /** Request timeout in milliseconds. */
    timeout?: number;
}

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

interface ApiErrorPayload {
    detail?: string;
    non_field_errors?: string[];
    [field: string]: unknown;
}

function formatApiError(payload: ApiErrorPayload | null, fallback: string): string {
    if (!payload) return fallback;
    if (typeof payload.detail === "string" && payload.detail) return payload.detail;
    if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length) {
        return payload.non_field_errors.join(", ");
    }
    const parts: string[] = [];
    for (const [field, value] of Object.entries(payload)) {
        if (field === "detail" || field === "non_field_errors") continue;
        const label = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (Array.isArray(value)) {
            parts.push(`${label}: ${(value as string[]).join(", ")}`);
        } else if (typeof value === "string") {
            parts.push(`${label}: ${value}`);
        }
    }
    return parts.length ? parts.join("; ") : fallback;
}

function buildHeaders(headers?: HeadersInit): Record<string, string> {
    const base: Record<string, string> = {
        ...(headers as Record<string, string> | undefined),
    };
    return base;
}

async function request<T>(
    path: string,
    { body, headers, isFormData, timeout, ...options }: RequestOptions = {},
): Promise<T> {
    const isBodyFormData = isFormData === true;
    const finalHeaders = buildHeaders(
        isBodyFormData
            ? headers
            : {
                "Content-Type": "application/json",
                ...headers,
            },
    );

    const method = (options.method ?? "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !finalHeaders["X-CSRFToken"]) {
        const csrf = getCookie("csrftoken") ?? (await getCsrfToken());
        if (csrf) {
            finalHeaders["X-CSRFToken"] = csrf;
        }
    }

    const controller = new AbortController();
    const timeoutId = timeout ?? DEFAULT_TIMEOUT_MS ? setTimeout(() => controller.abort(), timeout ?? DEFAULT_TIMEOUT_MS) : undefined;

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: finalHeaders,
            credentials: "include",  // 🔑 Critical: Include cookies
            body:
                body === undefined
                    ? undefined
                    : isBodyFormData
                        ? (body as FormData)
                        : JSON.stringify(body),
            signal: controller.signal,
        });

        if (response.status === 401) {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("session:expired"));
            }
            clearAuth();
            if (typeof window !== "undefined") {
                window.location.reload();
                window.location.href = "/login";
            }
            throw new ApiError("Sesi login telah berakhir.", 401);
        }

        if (!response.ok) {
            const errorData = (await response.json().catch(() => null)) as
                | ApiErrorPayload
                | null;
            throw new ApiError(
                formatApiError(errorData, `Permintaan gagal (${response.status}).`),
                response.status,
            );
        }

        if (response.status === 204) {
            return undefined as T;
        }
        return response.json() as Promise<T>;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new ApiError("Permintaan timeout. Silakan coba lagi.", 408);
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

export interface StreamEventData {
    type: "step" | "token" | "done" | "error" | "init" | string;
    query_id?: number;
    conversation_id?: number;
    step?: string;
    message?: string;
    token?: string;
    data?: {
        success?: boolean;
        query_id?: number;
        answer_id?: number | null;
        answer?: string;
        response_time_ms?: number;
        sources?: Array<{
            source: string;
            page?: number | null;
            score?: number | null;
            excerpt?: string;
            [key: string]: unknown;
        }>;
        conversation_id?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface StreamOptions {
    body?: unknown;
    headers?: HeadersInit;
    signal?: AbortSignal;
    onEvent: (data: StreamEventData) => void;
    onError?: (error: Error) => void;
    onDone?: () => void;
}

async function streamPost(
    path: string,
    { body, headers, signal, onEvent, onError, onDone }: StreamOptions,
): Promise<void> {
    const finalHeaders = buildHeaders({
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...headers,
    });

    const csrf = getCookie("csrftoken") ?? (await getCsrfToken());
    if (csrf) {
        finalHeaders["X-CSRFToken"] = csrf;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: finalHeaders,
            credentials: "include",
            body: body ? JSON.stringify(body) : undefined,
            signal,
        });

        if (!response.ok) {
            const err = (await response.json().catch(() => null)) as ApiErrorPayload | null;
            throw new ApiError(formatApiError(err, `Stream gagal (${response.status})`), response.status);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Respons streaming tidak dapat dibaca");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed || trimmed.startsWith(":")) continue;

                if (trimmed.startsWith("data: ")) {
                    const jsonStr = trimmed.slice(6);
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }
                    onEvent(parsed as StreamEventData);
                }
            }
        }
        onDone?.();
    } catch (err) {
        if (onError && err instanceof Error) {
            onError(err);
        } else {
            throw err;
        }
    }
}

export const api = {
    get: <T>(path: string, options?: RequestOptions) => request<T>(path, options),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
        request<T>(path, { method: "POST", body, ...options }),
    patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
        request<T>(path, { method: "PATCH", body, ...options }),
    delete: <T>(path: string, options?: RequestOptions) =>
        request<T>(path, { method: "DELETE", ...options }),
    uploadFile: <T>(path: string, formData: FormData, options?: Omit<RequestOptions, "body" | "isFormData">) =>
        request<T>(path, { method: "POST", body: formData, isFormData: true, ...options }),
    streamPost: (path: string, options: StreamOptions) => streamPost(path, options),
    getEventSourceUrl: (path: string) => `${API_BASE_URL}${path}`,
};

export interface DocumentItem {
    id: number;
    document_name: string;
    size: number;
    file_type: string;
    status: string;
    is_ocr: boolean;
}

export const documentsApi = {
    list: () => api.get<{ results: DocumentItem[] }>("/documents/"),
    upload: (formData: FormData) => api.uploadFile<{ message: string }>("/ingest/upload/", formData).then((res) => res),
    remove: (id: number) => api.delete<void>(`/documents/${id}/`).then(() => undefined),
    ingest: (id: number) => api.post<{ message: string; document_id: number; session_id: string; status: string }>(`/ingest/${id}/re-ingest/`).then((res) => res),
};

export const queriesApi = {
    stop: (id: number) => api.post<{ status: string; query_id: number }>(`/queries/${id}/stop/`),
};

export const monitoringApi = {
    getMySummary: () => api.get<MyTokenUsage>("/monitoring/my-summary/"),
    getSummary: (params?: { date?: string; start_date?: string; end_date?: string; user_id?: number }) => {
        const query = new URLSearchParams();
        if (params?.date) query.set("date", params.date);
        if (params?.start_date) query.set("start_date", params.start_date);
        if (params?.end_date) query.set("end_date", params.end_date);
        if (params?.user_id) query.set("user_id", String(params.user_id));
        const qs = query.toString();
        return api.get<TokenSummary>(`/monitoring/summary/${qs ? `?${qs}` : ""}`);
    },
    getCharts: (params?: { days?: number; user_id?: number }) => {
        const query = new URLSearchParams();
        if (params?.days) query.set("days", String(params.days));
        if (params?.user_id) query.set("user_id", String(params.user_id));
        const qs = query.toString();
        return api.get<ChartsData>(`/monitoring/charts/${qs ? `?${qs}` : ""}`);
    },
    getQueryLogs: (params?: { page?: number; user_id?: number; status_code?: number; date?: string }) => {
        const query = new URLSearchParams();
        if (params?.page) query.set("page", String(params.page));
        if (params?.user_id) query.set("user_id", String(params.user_id));
        if (params?.status_code) query.set("status_code", String(params.status_code));
        if (params?.date) query.set("date", params.date);
        const qs = query.toString();
        return api.get<PaginatedQueryLogs>(`/monitoring/query-logs/${qs ? `?${qs}` : ""}`);
    },
    getQueryLogsStreamUrl: () => api.getEventSourceUrl("/monitoring/query-logs/stream/"),
};

export type { RequestOptions };
