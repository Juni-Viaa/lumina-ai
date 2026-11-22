"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
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
            {/* Sidebar (selalu statis, tidak overlap konten) */}
            <Sidebar onClose={() => {}} />

            {/* Main view container */}
            <div id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Mobile top bar */}
                <header className="flex h-14 items-center justify-between border-b border-white/20 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 px-4 backdrop-blur-md md:hidden shrink-0">
                    <div className="flex items-center gap-2">
                        <Image src="/images/icons/Logo.png" width={24} height={24} alt="Lumina" className="h-6 w-6 object-contain" />
                        <span className="text-base font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                            Lumi<span className="text-[#3b82f6]">na</span>
                        </span>
                    </div>

                    <div className="w-9" aria-hidden="true" />
                </header>

                <main className="min-h-0 flex-1 overflow-hidden pb-16 md:pb-0">{children}</main>
            </div>

            {/* Mobile bottom navigation */}
            <BottomNav />
        </div>
    );
}
