"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser } from "@/lib/auth";

// ponytail: static bottom nav links. Upgrade to config array if additional tabs (e.g. Settings, History) are added for mobile.
export default function BottomNav() {
    const pathname = usePathname();
    const user = getUser();
    const isAdmin = user?.role === "admin" || user?.is_staff === true;
    const isDosen = user?.role === "dosen";
    const canUpload = isAdmin || isDosen;

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/";
        return pathname.startsWith(path);
    };

    return (
        <nav
            id="bottom-nav"
            aria-label="Navigasi bawah seluler"
            className="hidden"
        >
            {/* Chat Tab */}
            <Link
                href="/"
                className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition-all ${
                    isActive("/")
                        ? "text-[#2563eb] dark:text-[#60a5fa] font-semibold"
                        : "text-[#334e68] dark:text-[#94a3b8] hover:text-[#2563eb]"
                }`}
                aria-current={isActive("/") ? "page" : undefined}
            >
                <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                    />
                </svg>
                <span className="text-[11px]">Chat</span>
            </Link>

            {/* Upload — admin & dosen */}
            {canUpload && (
                <Link
                    href="/upload"
                    className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition-all ${
                        isActive("/upload")
                            ? "text-[#2563eb] dark:text-[#60a5fa] font-semibold"
                            : "text-[#334e68] dark:text-[#94a3b8] hover:text-[#2563eb]"
                    }`}
                    aria-current={isActive("/upload") ? "page" : undefined}
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                    </svg>
                    <span className="text-[11px]">Upload</span>
                </Link>
            )}

            {/* Monitoring — admin only */}
            {isAdmin && (
                <Link
                    href="/monitoring"
                    className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition-all ${
                        isActive("/monitoring")
                            ? "text-[#2563eb] dark:text-[#60a5fa] font-semibold"
                            : "text-[#334e68] dark:text-[#94a3b8] hover:text-[#2563eb]"
                    }`}
                    aria-current={isActive("/monitoring") ? "page" : undefined}
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                        />
                    </svg>
                    <span className="text-[11px]">Monitoring</span>
                </Link>
            )}
        </nav>
    );
}
