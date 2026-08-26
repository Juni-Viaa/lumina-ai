export default function ChangePasswordPage() {
  return (
    <div className="glass-panel flex h-full flex-col">
      <div className="px-6 py-5">
        <h1 className="text-xl font-semibold text-[#1a3a52]">
          Ganti Password
        </h1>
        <p className="mt-1 text-sm text-[#1a3a52]/60">
          Skeleton proyek — halaman ini akan menampilkan form ganti password.
        </p>
      </div>

      <div className="flex flex-1 items-start justify-center p-6">
        <form className="glass-inner w-full max-w-md space-y-4 rounded-2xl p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Password Lama
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/20 bg-white/60 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="Masukkan password lama"
              disabled
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Password Baru
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/20 bg-white/60 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="Masukkan password baru"
              disabled
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1a3a52]">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/20 bg-white/60 px-4 py-2.5 text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:border-[#1a6fa8]/50 focus:outline-none"
              placeholder="Ulangi password baru"
              disabled
            />
          </div>

          <button
            type="submit"
            disabled
            className="w-full rounded-xl bg-[#1a6fa8] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Simpan Password
          </button>
        </form>
      </div>
    </div>
  );
}