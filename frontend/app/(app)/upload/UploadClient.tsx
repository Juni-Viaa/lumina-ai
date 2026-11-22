"use client";

import Link from "next/link";
import { getUser } from "@/lib/auth";
import ManageSection from "./_components/ManageSection";

// ponytail: static role check against current session; upgrade to capability-based permission guards if granular role permissions are added.
export default function UploadPage() {
    const user = getUser();
    const isAdmin = user?.role === "admin" && user.is_staff === true;

    if (!isAdmin) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="glass-panel max-w-md p-8 rounded-3xl border shadow-xl flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    </div>
                    <h2 className="text-base font-bold text-[#0f2436] dark:text-[#f0f6fc] mb-1">
                        Akses Terbatas
                    </h2>
                    <p className="text-xs text-[#0f2436]/60 dark:text-[#f0f6fc]/60 mb-6 leading-relaxed">
                        Halaman manajemen dokumen dan upload pipeline hanya dapat diakses oleh administrator sistem Lumina.
                    </p>
                    <Link
                        href="/"
                        className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                    >
                        Kembali ke Beranda
                    </Link>
                </div>
            </div>
        );
    }

    return <ManageSection />;
}
