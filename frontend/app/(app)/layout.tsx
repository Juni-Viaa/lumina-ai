"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { api, ApiError } from "@/lib/api";
import { clearAuth, getToken, setUser, type AuthUser } from "@/lib/auth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    // Validasi token ke backend; bila tidak sah, arahkan ke login.
    api
      .get<AuthUser>("/auth/me/")
      .then((user) => {
        setUser(user);
        setReady(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearAuth();
          router.replace("/login");
        } else {
          // Token ada tapi jaringan/backend bermasalah — tetap tampil, data
          // akan gagal di-fetch bila memang tidak berizin.
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
    <div className="flex h-full gap-2 p-2 md:gap-3 md:p-4">
      {/* Mobile overlay */}
      <div
        id="sidebar-overlay"
        className={`md:hidden ${isSidebarOpen ? "active" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Right column */}
      <div
        id="main-content"
        className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3"
      >
        {/* Mobile header with menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="glass-inner flex h-9 w-9 items-center justify-center rounded-lg"
            aria-label="Buka menu"
          >
            <svg
              className="h-5 w-5 text-[#1a6fa8]/70"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <div className="flex-1">
            <Header />
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden md:block">
          <Header />
        </div>

        {/* Main content */}
        <main className="min-h-0 flex-1 overflow-visible">{children}</main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}