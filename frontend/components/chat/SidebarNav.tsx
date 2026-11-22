"use client";

import Link from "next/link";

interface SidebarNavProps {
    pathname: string;
    onClose: () => void;
}

export function SidebarNav({ pathname, onClose }: SidebarNavProps) {
    return (
        <div className="px-3 py-1 space-y-1 shrink-0">
            <Link
                href="/"
                onClick={() => {
                    onClose();
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ${
                    pathname === "/" && !pathname.includes("/conversation")
                        ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/50"
                }`}
            >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                <span>Tanya Jawab Dokumen</span>
            </Link>

            {true && (
                <Link
                    href="/upload"
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ${
                        pathname === "/upload"
                            ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/50"
                    }`}
                >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Kelola Dokumen</span>
                </Link>
            )}
        </div>
    );
}