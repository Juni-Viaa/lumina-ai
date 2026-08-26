export default function UploadPage() {
  return (
    <div className="glass-panel flex h-full flex-col">
      <div className="px-6 py-5">
        <h1 className="text-xl font-semibold text-[#1a3a52]">
          Upload Dokumen
        </h1>
        <p className="mt-1 text-sm text-[#1a3a52]/60">
          Skeleton proyek — halaman ini akan menampilkan fitur upload dokumen
          untuk admin.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="glass-inner upload-bar w-full max-w-xl rounded-2xl border-2 border-dashed border-[#1a6fa8]/30 p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a6fa8]/10">
            <svg
              className="h-8 w-8 text-[#1a6fa8]/70"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#1a3a52]">
            Tarik & letakkan file di sini
          </p>
          <p className="mt-1 text-xs text-[#1a3a52]/50">
            atau klik untuk memilih file (PDF/DOCX)
          </p>
        </div>
      </div>
    </div>
  );
}