"use client";

interface DocumentStatsProps {
    stats: {
        total: number;
        indexed: number;
        processing: number;
        failed: number;
    };
    activeFilter: string;
    onSelectFilter: (status: string) => void;
}

// ponytail: 4 static stat categories suffice for current ingestion lifecycle; upgrade to dynamic facet list if custom pipeline stages are added.
export default function DocumentStats({
    stats,
    activeFilter,
    onSelectFilter,
}: DocumentStatsProps) {
    const cards = [
        {
            key: "all",
            label: "Total Dokumen",
            value: stats.total,
            badge: "Semua",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
            ),
            colorStyles: {
                iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                activeRing: "ring-2 ring-blue-500/60 bg-blue-500/5",
            },
        },
        {
            key: "indexed",
            label: "Berhasil Di-index",
            value: stats.indexed,
            badge: "Selesai",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            ),
            colorStyles: {
                iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                activeRing: "ring-2 ring-emerald-500/60 bg-emerald-500/5",
            },
        },
        {
            key: "processing",
            label: "Sedang Diproses",
            value: stats.processing,
            badge: "Pipeline",
            icon: (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
            ),
            colorStyles: {
                iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                activeRing: "ring-2 ring-amber-500/60 bg-amber-500/5",
            },
        },
        {
            key: "failed",
            label: "Gagal Diproses",
            value: stats.failed,
            badge: "Perlu Cek",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
            ),
            colorStyles: {
                iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                activeRing: "ring-2 ring-rose-500/60 bg-rose-500/5",
            },
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0" role="region" aria-label="Statistik Dokumen">
            {cards.map((card) => {
                const isActive = activeFilter === card.key;
                return (
                    <button
                        key={card.key}
                        type="button"
                        onClick={() => onSelectFilter(card.key)}
                        aria-pressed={isActive}
                        className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer glass-card border ${
                            isActive
                                ? card.colorStyles.activeRing
                                : "hover:border-primary/30"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105 ${card.colorStyles.iconBg}`}
                            >
                                {card.icon}
                            </div>
                            <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#0f2436]/70 dark:text-[#f0f6fc]/70">
                                {card.badge}
                            </span>
                        </div>

                        <div className="mt-3">
                            <p className="text-2xl font-bold tracking-tight text-[#0f2436] dark:text-[#f0f6fc]">
                                {card.value}
                            </p>
                            <p className="text-xs font-medium text-[#0f2436]/60 dark:text-[#f0f6fc]/60 mt-0.5">
                                {card.label}
                            </p>
                        </div>

                        {isActive && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
