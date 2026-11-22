"use client";

import Link from "next/link";
import Image from "next/image";

interface SidebarHeaderProps {
    onClose: () => void;
    handleNewChat: () => void;
}

export function SidebarHeader({ onClose, handleNewChat }: SidebarHeaderProps) {
    return (
        <div className="flex h-16 items-center justify-between border-b border-slate-200/60 dark:border-slate-800/70 px-4 shrink-0">
            {/* Logo & Branding */}
            <Link
                href="/"
                className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                onClick={() => {
                    handleNewChat();
                    onClose();
                }}
            >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20 p-1 border border-blue-500/20">
                    <Image
                        src="/images/icons/Logo.png"
                        width={32}
                        height={32}
                        className="h-full w-full object-contain"
                        alt="Logo Lumina"
                    />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 leading-none">
                        <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Lumi<span className="text-blue-600 dark:text-blue-400">na</span>
                        </span>
                        <span className="rounded-full bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            RAG
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        AI Document Assistant
                    </span>
                </div>
            </Link>

            {/* Mobile close button */}
            <button
                type="button"
                onClick={onClose}
                aria-label="Tutup menu navigasi"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors md:hidden"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}