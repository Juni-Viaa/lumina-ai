export default function DashboardPage() {
  return (
    <div className="glass-panel flex h-full flex-col">
      {/* Header area */}
      <div className="px-6 py-5">
        <h1 className="text-xl font-semibold text-[#1a3a52]">
          Dashboard / Chat
        </h1>
        <p className="mt-1 text-sm text-[#1a3a52]/60">
          Skeleton proyek — halaman ini akan menampilkan fitur chat Q&A dokumen.
        </p>
      </div>

      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col justify-end gap-4 p-6">
        {/* Placeholder empty state */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="glass-inner flex h-16 w-16 items-center justify-center rounded-2xl">
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
                d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
              />
            </svg>
          </div>
          <p className="text-sm text-[#1a3a52]/50">
            Mulai percakapan dengan mengirim pertanyaan
          </p>
        </div>

        {/* Input bar skeleton */}
        <div className="glass-inner flex items-center gap-2 rounded-2xl px-4 py-3">
          <input
            type="text"
            placeholder="Tanyakan sesuatu tentang dokumenmu..."
            className="flex-1 bg-transparent text-sm text-[#1a3a52] placeholder:text-[#1a3a52]/40 focus:outline-none"
            disabled
          />
          <button
            disabled
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a6fa8]/20 text-[#1a3a52]/50"
            aria-label="Kirim"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}