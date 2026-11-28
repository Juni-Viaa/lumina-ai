"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { api } from "@/lib/api";
import { setUser, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

interface VerifyEmailResponse {
    user: AuthUser;
    message?: string;
}

interface ResendOtpResponse {
    message?: string;
}

function VerifyOtpContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramEmail = searchParams.get("email") || "";
    const [customEmail, setCustomEmail] = useState<string | null>(null);
    const email = customEmail !== null ? customEmail : paramEmail;
    const isEditingEmail = customEmail !== null || !paramEmail;

    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(60);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    // Countdown timer untuk resend OTP
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // Focus input digit pertama saat mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const otpValue = otpDigits.join("");

    function handleDigitChange(index: number, val: string) {
        // Hanya angka
        const clean = val.replace(/\D/g, "");
        if (!clean) {
            const next = [...otpDigits];
            next[index] = "";
            setOtpDigits(next);
            return;
        }

        const next = [...otpDigits];
        // Jika paste multi-digit ke satu kotak
        if (clean.length > 1) {
            const slice = clean.slice(0, 6);
            for (let i = 0; i < 6; i++) {
                next[i] = slice[i] || "";
            }
            setOtpDigits(next);
            const nextFocusIndex = Math.min(slice.length, 5);
            inputRefs.current[nextFocusIndex]?.focus();
            return;
        }

        next[index] = clean[0];
        setOtpDigits(next);
        setError(null);

        // Maju ke input berikutnya
        if (index < 5 && clean[0]) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        const next = ["", "", "", "", "", ""];
        for (let i = 0; i < text.length; i++) {
            next[i] = text[i];
        }
        setOtpDigits(next);
        setError(null);
        const focusIdx = Math.min(text.length, 5);
        inputRefs.current[focusIdx]?.focus();
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!email.trim()) {
            setError("Email wajib diisi.");
            errorSummaryRef.current?.focus();
            return;
        }

        if (otpValue.length < 6) {
            setError("Masukkan 6 digit kode verifikasi secara lengkap.");
            errorSummaryRef.current?.focus();
            return;
        }

        setLoading(true);
        try {
            const data = await api.post<VerifyEmailResponse>("/auth/verify-email/", {
                email: email.trim(),
                otp: otpValue,
            });

            setUser(data.user);
            router.replace("/");
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Verifikasi gagal. Pastikan kode yang Anda masukkan benar.",
            );
            errorSummaryRef.current?.focus();
        } finally {
            setLoading(false);
        }
    }

    async function handleResendOtp() {
        if (cooldown > 0 || resending) return;
        if (!email.trim()) {
            setError("Email wajib diisi untuk mengirim ulang kode.");
            return;
        }

        setError(null);
        setSuccessMessage(null);
        setResending(true);

        try {
            const data = await api.post<ResendOtpResponse>("/auth/resend-otp/", {
                email: email.trim(),
            });
            setSuccessMessage(
                data.message || "Kode verifikasi baru telah dikirim ke email Anda.",
            );
            setCooldown(60);
            setOtpDigits(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal mengirim ulang kode. Silakan coba lagi.",
            );
        } finally {
            setResending(false);
        }
    }

    return (
        <div className="flex h-screen h-[100dvh] max-h-screen w-full flex-col lg:flex-row bg-[#ebf4fa] text-[#1a3a52] overflow-hidden">
            {/* ── Left Panel (50% Desktop, Hidden on Mobile) ──────────────────── */}
            <div className="relative hidden w-full h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d346c] via-[#1a5db4] to-[#2b7de9] p-6 lg:flex lg:w-1/2 xl:p-10 text-white">
                {/* Decorative Glowing Orbs */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl"
                />

                {/* Ambient Grid overlay */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
                        backgroundSize: "28px 28px",
                    }}
                />

                {/* Top Header: Brand Logo & Badge */}
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 p-2 backdrop-blur-md border border-white/30 shadow-inner">
                            <Image
                                src="/images/icons/Logo.png"
                                alt="Lumina Logo"
                                width={32}
                                height={32}
                                className="h-full w-full object-contain drop-shadow"
                            />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm xl:text-2xl">
                            Lumina
                        </span>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium tracking-wide text-white/95 backdrop-blur-md shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>IF-4MD-08 • PBL 2026</span>
                    </div>
                </div>

                {/* Center Content: SVG Illustration & Tagline */}
                <div className="relative z-10 my-auto flex flex-col items-center py-2 text-center">
                    <div className="relative mb-4 w-full max-w-[200px] xl:mb-6 xl:max-w-[240px]">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 200 200"
                            className="h-auto w-full drop-shadow-2xl"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx="100" cy="100" r="80" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 6" />
                            <circle cx="100" cy="100" r="58" fill="rgba(255,255,255,0.15)" />
                            {/* Shield Icon */}
                            <path
                                d="M100 48 L140 64 V108 C140 132 122 152 100 158 C78 152 60 132 60 108 V64 Z"
                                fill="#ffffff"
                                opacity="0.95"
                            />
                            {/* Checkmark inside Shield */}
                            <path
                                d="M85 104 L95 114 L118 90"
                                stroke="#2563eb"
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    <h1 className="max-w-md text-xl font-bold tracking-tight text-white lg:text-2xl xl:text-3xl">
                        Verifikasi Keamanan Akun
                    </h1>
                    <p className="mt-2 max-w-md text-xs text-blue-100/85 leading-relaxed xl:text-sm">
                        Masukkan 6 digit kode OTP yang dikirimkan ke email Anda untuk mengaktifkan akun Lumina.
                    </p>
                </div>

                {/* Bottom Trust Badges */}
                <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 pt-2">
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md xl:text-xs">
                        Kode 6 Digit
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md xl:text-xs">
                        Berlaku 5 Menit
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md xl:text-xs">
                        Single-Use OTP
                    </div>
                </div>
            </div>

            {/* ── Right Panel (50% Desktop, Full Width Mobile) ────────────────── */}
            <div
                className="relative flex h-full w-full items-center justify-center overflow-y-auto p-4 sm:p-6 lg:w-1/2 lg:p-8 bg-cover bg-center"
                style={{ backgroundImage: "var(--bg-overlay), url('/images/Background.png')" }}
            >
                <GlassCard
                    variant="interactive"
                    className="relative my-auto w-full max-w-md overflow-hidden rounded-[24px] p-6 backdrop-blur-[20px] sm:p-8"
                >
                    {/* Header inside Card */}
                    <div className="mb-5 text-center sm:mb-6">
                        {/* Mobile Brand Header */}
                        <div className="mb-3 flex flex-col items-center lg:hidden">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 p-2 border border-blue-600/20 shadow-sm">
                                <Image
                                    src="/images/icons/Logo.png"
                                    alt="Lumina Logo"
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-contain"
                                />
                            </div>
                            <span className="mt-1.5 text-lg font-bold text-[#0f2436] dark:text-[#f0f6fc]">
                                Lumina
                            </span>
                            <span className="text-[10px] font-medium tracking-wide text-[#3b82f6] dark:text-[#60a5fa]">
                                IF-4MD-08 • PBL 2026
                            </span>
                        </div>

                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-xl font-bold tracking-tight text-[#0f2436] dark:text-[#f0f6fc] sm:text-2xl">
                            Verifikasi Email
                        </h2>
                        <p className="mt-1 text-xs text-[#334e68] dark:text-[#94a3b8] sm:text-sm">
                            Kode telah dikirimkan ke:
                        </p>
                        <div className="mt-0.5 flex items-center justify-center gap-1.5">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 sm:text-sm break-all">
                                {email || "email Anda"}
                            </span>
                            {paramEmail && (
                                <button
                                    type="button"
                                    onClick={() => setCustomEmail(customEmail !== null ? null : paramEmail)}
                                    className="text-[11px] font-medium text-slate-500 underline hover:text-blue-600 dark:text-slate-400"
                                >
                                    {customEmail !== null ? "(Batal)" : "(Ubah)"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Error Summary */}
                    {error && (
                        <div
                            ref={errorSummaryRef}
                            role="alert"
                            tabIndex={-1}
                            className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-700 shadow-sm backdrop-blur-sm animate-in fade-in duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 sm:text-sm"
                        >
                            <svg
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <p className="leading-tight">{error}</p>
                        </div>
                    )}

                    {/* Success notification */}
                    {successMessage && (
                        <div
                            role="status"
                            className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 shadow-sm backdrop-blur-sm animate-in fade-in duration-200 sm:text-sm"
                        >
                            <svg
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <p className="leading-tight">{successMessage}</p>
                        </div>
                    )}

                    {/* Verification Form */}
                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        {/* Email input if editing or if email missing */}
                        {isEditingEmail && (
                            <div className="text-left">
                                <label
                                    htmlFor="otp-email"
                                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#334e68] dark:text-[#94a3b8] mb-1 sm:text-xs"
                                >
                                    Alamat Email
                                </label>
                                <input
                                    id="otp-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setCustomEmail(e.target.value)}
                                    placeholder="nama@email.com"
                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3.5 py-2.5 text-sm text-[#0f2436] dark:text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                                />
                            </div>
                        )}
                        {/* 6-Digit OTP inputs */}
                        <div>
                            <label className="block text-center text-[11px] font-semibold uppercase tracking-wider text-[#334e68] dark:text-[#94a3b8] mb-2 sm:text-xs">
                                Masukkan 6 Digit Kode OTP
                            </label>
                            <div className="flex justify-between gap-1.5 sm:gap-2">
                                {otpDigits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => {
                                            inputRefs.current[idx] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        onPaste={handlePaste}
                                        aria-label={`Digit ke-${idx + 1}`}
                                        className={cn(
                                            "h-12 w-11 sm:h-14 sm:w-12 text-center text-xl sm:text-2xl font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-[#0f2436] dark:text-white shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40",
                                            digit && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20",
                                            error && "border-red-400 focus:border-red-500 focus:ring-red-400/30",
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                            <GlassButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={loading || otpValue.length < 6}
                                className="w-full gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg
                                            aria-hidden="true"
                                            className="h-4 w-4 animate-spin text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        <span>Memverifikasi…</span>
                                    </>
                                ) : (
                                    <span>Verifikasi Akun</span>
                                )}
                            </GlassButton>
                        </div>

                        {/* Resend OTP */}
                        <div className="pt-2 text-center">
                            <p className="text-xs text-[#52748d] dark:text-[#94a3b8]">
                                Tidak menerima kode?{" "}
                                {cooldown > 0 ? (
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                                        Kirim ulang dalam ({cooldown}s)
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resending}
                                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 dark:text-blue-400"
                                    >
                                        {resending ? "Mengirim ulang…" : "Kirim ulang kode"}
                                    </button>
                                )}
                            </p>
                        </div>

                        {/* Change Email or Back to Login */}
                        <div className="pt-1 flex items-center justify-between text-xs text-[#52748d] dark:text-[#94a3b8] border-t border-slate-200/60 dark:border-slate-800 pt-3">
                            <Link
                                href="/register"
                                className="text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                &larr; Ubah email
                            </Link>
                            <Link
                                href="/login"
                                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                            >
                                Masuk ke akun
                            </Link>
                        </div>
                    </form>
                </GlassCard>
            </div>
        </div>
    );
}

export default function VerifyOtpPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen w-full items-center justify-center bg-[#ebf4fa] text-[#1a3a52]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
            }
        >
            <VerifyOtpContent />
        </Suspense>
    );
}
