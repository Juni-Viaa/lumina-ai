"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { setAuth, type AuthUser } from "@/lib/auth";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<LoginResponse>("/auth/login/", {
        email: email.trim(),
        password,
      });
      setAuth(data.token, data.user);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal masuk. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl shadow-lg">
      <div className="glass-inner w-full max-w-md overflow-hidden rounded-3xl border border-white/30 backdrop-blur-md">
        {/* Header */}
        <div className="bg-blue-200/30 py-4 text-center text-lg font-semibold text-black backdrop-blur-md">
          Masuk
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="mx-auto mb-6 h-24 w-24 rounded-lg">
            <img src="/images/icons/Logo.png" alt="Logo" className="h-full w-full rounded-lg object-cover" />
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-300/60 bg-red-50/80 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nama Pengguna / Email"
                autoComplete="email"
                className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-2 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                autoComplete="current-password"
                className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-2 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
              />
            </div>

            <div className="text-center">
              <button
                type="submit"
                disabled={loading}
                className="glass-inner rounded-full bg-[#C9DCE4] px-6 py-2 text-sm text-black backdrop-blur-md transition hover:bg-[#92C7DD] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Memproses…" : "Masuk"}
              </button>
            </div>

            <div className="flex justify-center text-sm text-black/70">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-black/50 bg-transparent focus:border-black focus:ring-0" defaultChecked />
                Ingat Saya
              </label>
            </div>

            <div className="flex justify-center text-xs text-black/70">
              <Link href="/register" className="hover:underline">
                Belum punya akun? Daftar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}