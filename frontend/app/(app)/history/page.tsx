export default function HistoryPage() {
  return (
    <div className="glass-panel flex h-full flex-col">
      <div className="px-6 py-5">
        <h1 className="text-xl font-semibold text-[#1a3a52]">
          Riwayat Chat
        </h1>
        <p className="mt-1 text-sm text-[#1a3a52]/60">
          Skeleton proyek — halaman ini akan menampilkan riwayat percakapan
          pengguna.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="glass-inner mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <svg
              className="h-8 w-8 text-[#1a6fa8]/60"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-[#1a3a52]/50">Belum ada riwayat chat</p>
        </div>
      </div>
    </div>
  );
}