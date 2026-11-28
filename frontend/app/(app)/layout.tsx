"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { setUser, checkSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";

// ponytail: basic layout shell. Upgrade to layout state persistence (e.g. cookie-based sidebar state) if collapsible desktop rail is requested.
export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        checkSession()
            .then((user) => {
                if (user) {
                    setUser(user);
                    setReady(true);
                } else {
                    router.replace("/login");
                }
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    router.replace("/login");
                } else {
                    setReady(true);
                }
            });
    }, [router]);

    // Close sidebar on Escape key
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape" && isSidebarOpen) setIsSidebarOpen(false);
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSidebarOpen]);

    if (!ready) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="glass-inner rounded-2xl px-6 py-4 text-sm font-medium text-[#0f2436] dark:text-[#f0f6fc]">
                    Memuat…
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Skip to content accessibility link */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-xl focus:outline-none"
            >
                Langsung ke konten utama
            </a>

            {/* Overlay backdrop — mobile only, visible when sidebar open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
                    aria-hidden="true"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar — static on desktop, slide-in drawer on mobile */}
            <div
                className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:static md:z-auto md:translate-x-0 md:flex md:shrink-0 ${
                    isSidebarOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none md:pointer-events-auto"
                }`}
            >
                <Sidebar onClose={() => setIsSidebarOpen(false)} />
            </div>

            {/* Main view container */}
            <div id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Mobile top bar */}
                <header className="flex h-14 items-center justify-between border-b border-white/20 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 px-4 backdrop-blur-md md:hidden shrink-0">
                    {/* Hamburger button */}
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Buka menu navigasi"
                        aria-expanded={isSidebarOpen}
                        aria-controls="app-sidebar"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    {/* Brand logo */}
                    <div className="flex items-center gap-2">
                        <Image src="/images/icons/Logo.png" width={24} height={24} alt="Lumina" className="h-6 w-6 object-contain" />
                        <span className="text-base font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                            Lumi<span className="text-[#3b82f6]">na</span>
                        </span>
                    </div>

                    {/* Spacer to balance hamburger */}
                    <div className="w-9" aria-hidden="true" />
                </header>

                <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
            </div>
        </div>
    );
}
