import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  return (
    <div className="guest-glass-panel w-full max-w-md overflow-hidden">
      <div className="p-8">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="guest-glass-inner flex items-center gap-3 rounded-xl px-6 py-3">
            <Image
              src="/images/icons/Logo.png"
              width={48}
              height={32}
              className="h-8 w-12 opacity-70"
              alt="Logo"
            />
            <span className="text-lg font-semibold tracking-tight text-[#1a3a52]">
              Lumina
            </span>
          </div>
        </div>

        <h1 className="mb-6 text-center text-2xl font-semibold text-[#1a3a52]">
          Daftar
        </h1>

        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Nama
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="Nama lengkap"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Konfirmasi Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/30 bg-white/40 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="Ulangi password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#1a6fa8] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Daftar
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[#1a3a52]/60">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-[#1a6fa8] hover:underline"
          >
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}