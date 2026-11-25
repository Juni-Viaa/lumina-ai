"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { monitoringApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useQueryLogsSSE } from "@/hooks/useQueryLogsSSE";
import type { ChartsData, QueryLogItem, TokenSummary } from "@/types/monitoring";

export default function MonitoringPage() {
    const user = getUser();
    const isAdmin = user?.role === "admin" || user?.is_staff === true;
    const toast = useToast();

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    });

    const [chartDays, setChartDays] = useState<number>(7);
    const [summary, setSummary] = useState<TokenSummary | null>(null);
    const [charts, setCharts] = useState<ChartsData | null>(null);
    const [logs, setLogs] = useState<QueryLogItem[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingCharts, setLoadingCharts] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [sseConnected, setSseConnected] = useState(true);

    // 1. Fetch summary
    const loadSummary = useCallback(async (date: string) => {
        try {
            const data = await monitoringApi.getSummary({ date });
            setSummary(data);
        } catch {
            toast.error("Gagal memuat ringkasan token.");
        } finally {
            setLoadingSummary(false);
        }
    }, [toast]);

    // 2. Fetch charts
    const loadCharts = useCallback(async (days: number) => {
        try {
            const data = await monitoringApi.getCharts({ days });
            setCharts(data);
        } catch {
            toast.error("Gagal memuat grafik token.");
        } finally {
            setLoadingCharts(false);
        }
    }, [toast]);

    // 3. Fetch query logs
    const loadQueryLogs = useCallback(async () => {
        try {
            const data = await monitoringApi.getQueryLogs({ page: 1 });
            setLogs(data.results || []);
        } catch {
            toast.error("Gagal memuat log query.");
        } finally {
            setLoadingLogs(false);
        }
    }, [toast]);

    // Initial data load
    useEffect(() => {
        if (!isAdmin) return;
        let ignore = false;

        async function fetchAll() {
            try {
                const [sumRes, chartRes, logRes] = await Promise.allSettled([
                    monitoringApi.getSummary({ date: selectedDate }),
                    monitoringApi.getCharts({ days: chartDays }),
                    monitoringApi.getQueryLogs({ page: 1 }),
                ]);

                if (!ignore) {
                    if (sumRes.status === "fulfilled") setSummary(sumRes.value);
                    if (chartRes.status === "fulfilled") setCharts(chartRes.value);
                    if (logRes.status === "fulfilled") setLogs(logRes.value.results || []);
                }
            } catch {
                if (!ignore) toast.error("Gagal memuat data monitoring.");
            } finally {
                if (!ignore) {
                    setLoadingSummary(false);
                    setLoadingCharts(false);
                    setLoadingLogs(false);
                }
            }
        }

        void fetchAll();

        return () => {
            ignore = true;
        };
    }, [isAdmin, selectedDate, chartDays, toast]);

    // Listen to real-time SSE query logs
    useQueryLogsSSE({
        enabled: isAdmin,
        onNewLog: (newLog) => {
            setSseConnected(true);
            setLogs((prev) => {
                // Prepend new log if not already present
                if (prev.some((item) => item.id === newLog.id)) return prev;
                return [newLog, ...prev.slice(0, 49)];
            });
            // Update summary request count & tokens if matching selected date
            setSummary((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    total_requests: prev.total_requests + 1,
                    total_input_tokens: prev.total_input_tokens + newLog.input_tokens,
                    total_output_tokens: prev.total_output_tokens + newLog.output_tokens,
                    total_tokens: prev.total_tokens + newLog.input_tokens + newLog.output_tokens,
                };
            });
        },
        onError: () => {
            setSseConnected(false);
        },
    });

    // Chart max calculations
    const maxChartTokens = useMemo(() => {
        if (!charts || !charts.daily_trends.length) return 1000;
        const maxVal = Math.max(...charts.daily_trends.map((d) => d.total_tokens), 100);
        return maxVal;
    }, [charts]);

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-6">
                <GlassCard className="max-w-md p-6 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                        Akses Ditolak
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Halaman Monitoring Token hanya dapat diakses oleh administrator sistem.
                    </p>
                    <Link href="/">
                        <GlassButton className="w-full mt-2">Kembali ke Chat</GlassButton>
                    </Link>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto px-4 py-6 md:px-8 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Monitoring Token & Sistem
                        </h1>
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                            {sseConnected ? "Live SSE" : "Offline"}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Pelacakan token Google Gemini, sliding window rate limit, dan log query real-time.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md">
                        <label htmlFor="filter-date" className="text-slate-500 dark:text-slate-400 font-medium">
                            Tanggal:
                        </label>
                        <input
                            id="filter-date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                    </div>

                    <GlassButton
                        onClick={() => {
                            void loadSummary(selectedDate);
                            void loadCharts(chartDays);
                            void loadQueryLogs();
                        }}
                        className="text-xs py-1.5 px-3"
                    >
                        Refresh
                    </GlassButton>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Token */}
                <GlassCard className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <span>Total Token Hari Ini</span>
                        <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    {loadingSummary ? (
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    ) : (
                        <div>
                            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {summary?.total_tokens.toLocaleString() ?? "0"}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                    {(summary?.total_input_tokens ?? 0).toLocaleString()} in
                                </span>
                                <span>•</span>
                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    {(summary?.total_output_tokens ?? 0).toLocaleString()} out
                                </span>
                            </div>
                        </div>
                    )}
                </GlassCard>

                {/* Total Permintaan */}
                <GlassCard className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <span>Total Permintaan</span>
                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    {loadingSummary ? (
                        <Skeleton className="h-8 w-20 rounded-lg" />
                    ) : (
                        <div>
                            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {summary?.total_requests.toLocaleString() ?? "0"}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                Rate limit: {summary?.limits.requests_per_minute ?? 5} req/menit (sliding)
                            </div>
                        </div>
                    )}
                </GlassCard>

                {/* Pengguna Aktif */}
                <GlassCard className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <span>Pengguna Aktif</span>
                        <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    {loadingSummary ? (
                        <Skeleton className="h-8 w-16 rounded-lg" />
                    ) : (
                        <div>
                            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {summary?.active_users_count ?? "0"}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                Interaksi pada {summary?.date ?? selectedDate}
                            </div>
                        </div>
                    )}
                </GlassCard>

                {/* Kuota Token Harian */}
                <GlassCard className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                        <span>Batas Kuota Harian</span>
                        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            100k / 100k
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            100k Input & 100k Output per user
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tren Token Harian (Bar Chart) */}
                <GlassCard className="lg:col-span-2 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Tren Penggunaan Token
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Distribusi total token input dan output selama periode terpilih
                            </p>
                        </div>

                        {/* Periode selector */}
                        <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 p-1 text-xs">
                            {[7, 14, 30].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setChartDays(days)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                        chartDays === days
                                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                    }`}
                                >
                                    {days} Hari
                                </button>
                            ))}
                        </div>
                    </div>

                    {loadingCharts ? (
                        <div className="h-56 flex items-end gap-3 pt-6">
                            {[...Array(7)].map((_, i) => (
                                <Skeleton key={i} className="flex-1 rounded-t-lg h-32" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3 pt-4">
                            {/* Bar Chart Container */}
                            <div className="h-52 flex items-end gap-2 sm:gap-3 border-b border-slate-200 dark:border-slate-800 pb-2 px-1">
                                {charts?.daily_trends.map((day) => {
                                    const heightPct = Math.max(8, Math.round((day.total_tokens / maxChartTokens) * 100));
                                    const inputHeightPct = day.total_tokens > 0 ? (day.input_tokens / day.total_tokens) * 100 : 50;
                                    const shortDate = day.date.slice(5); // MM-DD
                                    return (
                                        <div
                                            key={day.date}
                                            className="group relative flex-1 flex flex-col items-center h-full justify-end"
                                        >
                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col rounded-lg bg-slate-900/95 text-white p-2 text-[10px] shadow-lg pointer-events-none z-20 whitespace-nowrap dark:bg-slate-800">
                                                <span className="font-semibold text-slate-200">{day.date}</span>
                                                <span>Input: {day.input_tokens.toLocaleString()}</span>
                                                <span>Output: {day.output_tokens.toLocaleString()}</span>
                                                <span className="font-bold text-blue-300">Total: {day.total_tokens.toLocaleString()}</span>
                                                <span className="text-slate-400">{day.request_count} request</span>
                                            </div>

                                            {/* Bar */}
                                            <div
                                                style={{ height: `${heightPct}%` }}
                                                className="w-full rounded-t-md overflow-hidden bg-slate-200 dark:bg-slate-700/60 flex flex-col justify-end transition-all duration-300 hover:opacity-85"
                                            >
                                                {/* Output portion */}
                                                <div
                                                    style={{ height: `${100 - inputHeightPct}%` }}
                                                    className="w-full bg-purple-500/80"
                                                />
                                                {/* Input portion */}
                                                <div
                                                    style={{ height: `${inputHeightPct}%` }}
                                                    className="w-full bg-blue-500"
                                                />
                                            </div>

                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-2 truncate max-w-full">
                                                {shortDate}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                                    <span>Input Tokens</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" />
                                    <span>Output Tokens</span>
                                </div>
                            </div>
                        </div>
                    )}
                </GlassCard>

                {/* Top Pengguna (Leaderboard) */}
                <GlassCard className="p-5 space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Pengguna Teratas
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Konsumsi token tertinggi dalam {chartDays} hari
                        </p>
                    </div>

                    {loadingCharts ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : charts?.top_users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs text-center">
                            Belum ada riwayat aktivitas pengguna pada periode ini.
                        </div>
                    ) : (
                        <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1">
                            {charts?.top_users.map((u, idx) => (
                                <div
                                    key={u.user_id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50/60 dark:bg-slate-800/40 p-2.5 border border-slate-100 dark:border-slate-800"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-bold">
                                            #{idx + 1}
                                        </div>
                                        <div className="min-w-0 truncate">
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {u.username}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                            {u.total_tokens.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{u.request_count} reqs</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Tabel Detail Token per Pengguna */}
            <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Penggunaan Token per Pengguna
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Rincian konsumsi token harian dan status kuota per akun
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                                <th className="pb-3 pr-4">Pengguna</th>
                                <th className="pb-3 pr-4">Input Tokens</th>
                                <th className="pb-3 pr-4">Output Tokens</th>
                                <th className="pb-3 pr-4">Total Tokens</th>
                                <th className="pb-3 pr-4">Permintaan</th>
                                <th className="pb-3 text-right">Status Kuota</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {loadingSummary ? (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-slate-400">
                                        Memuat data pengguna...
                                    </td>
                                </tr>
                            ) : summary?.users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-400">
                                        Tidak ada aktivitas token pada tanggal {selectedDate}.
                                    </td>
                                </tr>
                            ) : (
                                summary?.users.map((u) => {
                                    const isNearLimit = u.input_percentage >= 80 || u.output_percentage >= 80;
                                    const isExceeded = u.input_percentage >= 100 || u.output_percentage >= 100;
                                    return (
                                        <tr key={u.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="py-3 pr-4">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {u.username}
                                                </div>
                                                <div className="text-[10px] text-slate-400">{u.email}</div>
                                            </td>

                                            {/* Input tokens + progress bar */}
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {u.input_tokens.toLocaleString()}
                                                </div>
                                                <div className="w-24 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        style={{ width: `${u.input_percentage}%` }}
                                                        className={`h-full rounded-full ${
                                                            u.input_percentage >= 90 ? "bg-rose-500" : "bg-blue-500"
                                                        }`}
                                                    />
                                                </div>
                                                <span className="text-[9px] text-slate-400">{u.input_percentage}% dari 100k</span>
                                            </td>

                                            {/* Output tokens + progress bar */}
                                            <td className="py-3 pr-4">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {u.output_tokens.toLocaleString()}
                                                </div>
                                                <div className="w-24 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        style={{ width: `${u.output_percentage}%` }}
                                                        className={`h-full rounded-full ${
                                                            u.output_percentage >= 90 ? "bg-rose-500" : "bg-purple-500"
                                                        }`}
                                                    />
                                                </div>
                                                <span className="text-[9px] text-slate-400">{u.output_percentage}% dari 100k</span>
                                            </td>

                                            <td className="py-3 pr-4 font-bold text-slate-900 dark:text-slate-100">
                                                {u.total_tokens.toLocaleString()}
                                            </td>

                                            <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                                                {u.request_count} req
                                            </td>

                                            <td className="py-3 text-right">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                        isExceeded
                                                            ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                                            : isNearLimit
                                                              ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                                              : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                                    }`}
                                                >
                                                    {isExceeded ? "Batas Terlampaui" : isNearLimit ? "Mendekati Batas" : "Aman"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Real-time Query Logs (SSE Stream) */}
            <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Log Aktivitas Query Seluruh Pengguna
                            </h2>
                            <span className="rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.2 text-[10px] font-semibold">
                                Real-time SSE
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Log otomatis terbarui saat ada query baru yang diproses sistem
                        </p>
                    </div>

                    <span className="text-[11px] text-slate-400">
                        Menampilkan {logs.length} riwayat terakhir
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                                <th className="pb-3 pr-4">Waktu</th>
                                <th className="pb-3 pr-4">Pengguna</th>
                                <th className="pb-3 pr-4">Endpoint</th>
                                <th className="pb-3 pr-4">Kueri / Pertanyaan</th>
                                <th className="pb-3 pr-4">Tokens</th>
                                <th className="pb-3 pr-4">Waktu Respons</th>
                                <th className="pb-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                            {loadingLogs ? (
                                <tr>
                                    <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                                        Memuat riwayat log...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                                        Belum ada catatan aktivitas query.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const timeStr = log.created_at
                                        ? new Date(log.created_at).toLocaleTimeString("id-ID")
                                        : "-";
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                                                {timeStr}
                                            </td>
                                            <td className="py-2.5 pr-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                                                {log.user_username || log.user_email || "Anonymous"}
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">
                                                {log.endpoint}
                                            </td>
                                            <td className="py-2.5 pr-4 font-sans text-slate-700 dark:text-slate-300 max-w-xs truncate">
                                                {log.query_title || log.query_text || log.error_message || "-"}
                                            </td>
                                            <td className="py-2.5 pr-4 whitespace-nowrap">
                                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                    {log.input_tokens} in
                                                </span>{" "}
                                                •{" "}
                                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                                    {log.output_tokens} out
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {log.response_time_ms ? `${log.response_time_ms} ms` : "-"}
                                            </td>
                                            <td className="py-2.5 text-right">
                                                <span
                                                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                                        log.status_code === 200
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                                            : log.status_code === 429
                                                              ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                                              : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                                    }`}
                                                >
                                                    {log.status_code}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}
