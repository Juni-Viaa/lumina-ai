"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { setAuth, type AuthUser } from "@/lib/auth";

interface RegisterResponse {
  token: string;
  user: AuthUser;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Semua kolom wajib diisi.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (!agree) {
      setError("Anda harus menyetujui Syarat & Ketentuan terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<RegisterResponse>("/auth/register/", {
        username: name.trim(),
        email: email.trim(),
        password,
        password_confirm: confirmPassword,
      });
      setAuth(data.token, data.user);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mendaftar. Silakan coba lagi.",
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
          Daftar
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

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-1 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Pengguna"
              autoComplete="name"
              className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-2 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata Sandi"
              autoComplete="new-password"
              className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-1 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi Kata Sandi"
              autoComplete="new-password"
              className="w-full border-0 border-b border-black/50 bg-transparent px-0 py-1 text-black placeholder:text-black/50 focus:border-black focus:outline-none focus:ring-0"
            />

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm leading-6 text-black/70">
                Saya telah membaca dan menyetujui{" "}
                <span className="font-semibold text-blue-700">Syarat & Ketentuan</span>.
              </span>
            </label>

            <div className="text-center">
              <button
                type="submit"
                disabled={loading || !agree}
                className="glass-inner rounded-full bg-[#C9DCE4] px-6 py-2 text-sm text-black backdrop-blur-md transition duration-200 hover:bg-[#92C7DD] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Memproses…" : "Daftar"}
              </button>
            </div>

            <div className="flex justify-center text-xs text-black/70">
              <Link href="/login" className="hover:underline">
                Sudah punya akun? Masuk
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}