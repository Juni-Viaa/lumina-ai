"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { setUser, checkSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
                    // Network/backend issue — still show page, data
                    // will fail if not authorized.
                    setReady(true);
                }
            });
    }, [router]);

    if (!ready) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="glass-inner rounded-xl px-6 py-4 text-sm text-[#1a3a52]/70">
                    Memuat…
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div
                id="main-content"
                className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3"
            >
                <main className="min-h-0 flex-1 overflow-visible">{children}</main>
            </div>

            <BottomNav />
        </div>
    );
}