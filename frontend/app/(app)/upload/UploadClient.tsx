"use client";

/**
 * Halaman Upload & Manage — hasil adaptasi desain Blade (Laravel) ke React/Tailwind:
 * header segmentasi Upload | Dokumen, dropzone full-size, kartu file terpilih,
 * stepper proses, kartu sukses/gagal, serta daftar dokumen dengan aksi Chunks/Delete.
 */

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_SIZE_MB = 100;

const STEPS: ReadonlyArray<{ label: string; desc: string }> = [
  { label: "Mengunggah file", desc: "Mengirim dokumen ke server" },
  { label: "Parsing & chunking", desc: "Struktur dokumen diekstraksi" },
  { label: "Embedding", desc: "Vektor dihitung untuk tiap chunk" },
  { label: "Penyimpanan", desc: "Chunk diindeks ke database" },
];

interface UploadResponse {
  message: string;
  document_id: number;
  session_id?: string | null;
  status?: string | null;
  chunks_added: number;
}

interface DocumentItem {
  id: number;
  document_name: string;
  size_human?: string | null;
  size: number;
  status: string;
  created_at: string;
}

type DocsPayload = DocumentItem[] | { results?: DocumentItem[] };

interface ChunkItem {
  id: number;
  chunk_text: string;
}

interface UploadErrorState {
  message: string;
  status?: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} ${time}`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "processing":
    case "pending":
      return "text-yellow-600";
    case "indexed":
    case "completed":
    case "success":
      return "text-green-600";
    case "failed":
    case "error":
      return "text-rose-500";
    default:
      return "text-[#1a3a52]/60";
  }
}

export default function UploadPage() {
  const router = useRouter();
  const user = getUser();
  const isAdmin = user?.role === "admin" && user?.is_staff === true;
  const [tab, setTab] = useState<"upload" | "manage">("upload");

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="glass-panel flex h-full items-center justify-center p-6 text-center text-sm text-[#1a3a52]/70">
        Anda tidak memiliki izin untuk mengakses halaman upload.
      </div>
    );
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      {/* Header segmentasi ala upload-header.blade.php */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 pb-3 pt-5">
        <h3 className="text-lg font-semibold leading-tight text-[#1a3a52]">
          Upload &amp; Manage
        </h3>
        <div className="glass-inner inline-flex rounded-2xl p-1">
          {(
            [
              ["upload", "Upload"],
              ["manage", "Dokumen"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                tab === key
                  ? "bg-white/35 text-[#1a3a52]"
                  : "text-[#1a3a52]/55 hover:text-[#1a3a52]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "upload" ? <UploadSection /> : <ManageSection />}
    </div>
  );
}

function UploadSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<UploadErrorState | null>(null);

  // Stepper visual berjalan selagi request upload diproses backend.
  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [uploading]);

  function reset() {
    setFile(null);
    setDragging(false);
    setUploading(false);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function isAllowed(candidate: File): boolean {
    const dot = candidate.name.lastIndexOf(".");
    const suffix = dot >= 0 ? candidate.name.slice(dot).toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.includes(suffix)) {
      setError({
        message: `Tipe file tidak didukung. Gunakan: ${ALLOWED_EXTENSIONS.join(", ")}.`,
      });
      return false;
    }
    if (candidate.size > MAX_SIZE_MB * 1024 * 1024) {
      setError({ message: `Ukuran file melebihi batas ${MAX_SIZE_MB} MB.` });
      return false;
    }
    return true;
  }

  function onSelect(selected: File | null) {
    setResult(null);
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (isAllowed(selected)) {
      setFile(selected);
    } else {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSelect(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onSelect(event.dataTransfer.files?.[0] ?? null);
  }

  async function submitUpload() {
    if (!file || uploading) return;
    setError(null);
    setCurrentStep(0);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const data = await api.uploadFile<UploadResponse>(
        "/ingest/upload/",
        formData,
      );
      setResult(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(
        err instanceof ApiError
          ? { message: err.message, status: err.status }
          : { message: "Gagal mengunggah dokumen." },
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 px-5 py-4">        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={handleChange}
        />

        {/* Idle: dropzone full-size */}
        {!file && !uploading && !result && !error && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`h-full w-full cursor-pointer rounded-3xl border-2 border-dashed border-[#1a6fa8]/20 transition-all duration-200 ${
              dragging
                ? "border-[#1a6fa8]/60 bg-white/25 ring-2 ring-[#1a6fa8]/30"
                : "glass-inner hover:border-[#1a6fa8]/35 hover:bg-white/15"
            }`}
          >
            <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/25">
                <svg
                  className="h-8 w-8 text-[#1a6fa8]/70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V8m0 0-3 3m3-3 3 3"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                  />
                </svg>
              </div>

              <div className="text-center">
                <p className="text-base font-medium text-[#1a3a52]">
                  Tarik &amp; lepas dokumen di sini
                </p>
                <p className="mt-1 text-sm text-[#1a3a52]/50">
                  atau klik untuk memilih file dari perangkatmu
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File terpilih */}
        {file && !uploading && !result && !error && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm">
              <div className="glass-inner flex items-center gap-3 rounded-2xl bg-white/20 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/30">
                  <svg
                    className="h-5 w-5 text-[#1a6fa8]/75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1a3a52]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#1a3a52]/50">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 text-xs text-[#1a6fa8]/60 transition-colors hover:text-[#1a6fa8]"
                >
                  Hapus
                </button>
              </div>

              <button
                type="button"
                onClick={submitUpload}
                className="glass-inner mt-3 w-full rounded-xl bg-white/25 py-2.5 text-sm font-medium text-[#1a6fa8] transition-all hover:bg-white/35"
              >
                Kirim
              </button>
            </div>
          </div>
        )}
                {/* Uploading: stepper ala upload-view.blade.php */}
        {uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm">
              <p className="mb-4 text-center text-xs uppercase tracking-widest text-[#1a3a52]/50">
                Memproses dokumen
              </p>
              <div className="space-y-2">
                {STEPS.map((step, i) => (
                  <div
                    key={step.label}
                    className={`glass-inner flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-500 ${
                      currentStep === i
                        ? "bg-white/25"
                        : currentStep > i
                          ? "opacity-50"
                          : "opacity-30"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                        currentStep > i
                          ? "bg-green-500/20"
                          : currentStep === i
                            ? "bg-[#1a6fa8]/15"
                            : "bg-white/10"
                      }`}
                    >
                      {currentStep > i ? (
                        <svg
                          className="h-4 w-4 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : currentStep === i ? (
                        <svg
                          className="h-4 w-4 animate-spin text-[#1a6fa8]"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
                        </svg>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[#1a3a52]/25" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium text-[#1a3a52] ${currentStep === i ? "opacity-100" : "opacity-50"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-[#1a3a52]/40">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sukses */}
        {result && !uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15">
                <svg className="h-7 w-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mb-1 text-base font-semibold text-[#1a3a52]">Upload berhasil!</p>
              <p className="text-sm text-[#1a3a52]/50">
                {result.message || "Dokumen sedang diproses oleh Lumina."}
              </p>
              <p className="mt-1 text-xs text-[#1a3a52]/45">
                {result.chunks_added} chunk terindeks · ID dokumen: {result.document_id}
              </p>
              <button
                type="button"
                onClick={reset}
                className="glass-inner mt-5 rounded-xl px-5 py-2 text-sm text-[#1a6fa8] transition-all hover:bg-white/30"
              >
                Upload lagi
              </button>
            </div>
          </div>
        )}

        {/* Gagal */}
        {error && !uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15">
                <svg className="h-7 w-7 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
              </div>
              <p className="mb-1 text-base font-semibold text-[#1a3a52]">Upload gagal.</p>
              <div className="space-y-2">
                <p className="font-medium text-red-500">{error.message}</p>
                {typeof error.status === "number" && (
                  <p className="text-xs text-[#1a3a52]/60">Error Code: {error.status}</p>
                )}
              </div>
              <button
                type="button"
                onClick={reset}
                className="glass-inner mt-5 rounded-xl px-5 py-2 text-sm text-[#1a6fa8] transition-all hover:bg-white/30"
              >
                Coba lagi
              </button>
            </div>
          </div>
        )}</div>
      {!uploading && !result && !error && (
        <div className="shrink-0 px-5 pb-5">
          <p className="text-center text-[11px] text-[#1a3a52]/50">
            PDF, DOC dan DOCX didukung · Maks. 100 MB
          </p>
        </div>
      )}
    </div>
  );
}

function ManageSection() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  // Dimulai `true`: mount pertama langsung menampilkan spinner di efek.
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  function applyDocs(payload: DocsPayload) {
    setDocs(Array.isArray(payload) ? payload : (payload.results ?? []));
  }

  useEffect(() => {
    // Pola konsisten dengan halaman lain: setState hanya di callback async.
    api
      .get<DocsPayload>("/documents/")
      .then((payload) => applyDocs(payload))
      .catch(() => setDocs([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  async function handleRefresh() {
    setLoadingDocs(true);
    try {
      applyDocs(await api.get<DocsPayload>("/documents/"));
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleDelete(doc: DocumentItem) {
    if (
      !window.confirm(
        `Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`,
      )
    )
      return;
    try {
      await api.delete(`/documents/${doc.id}/`);
      if (openId === doc.id) {
        setOpenId(null);
        setChunks([]);
      }
      await handleRefresh();
    } catch {
      // Biarkan daftar apa adanya bila penghapusan gagal.
    }
  }

  async function toggleChunks(doc: DocumentItem) {
    if (openId === doc.id) {
      setOpenId(null);
      setChunks([]);
      return;
    }
    setOpenId(doc.id);
    setLoadingChunks(true);
    try {
      const list = await api.get<ChunkItem[]>(`/documents/${doc.id}/chunks/`);
      setChunks(Array.isArray(list) ? list : []);
    } finally {
      setLoadingChunks(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      {/* Header ala document-view.blade.php */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#1a3a52]">
            Dokumen di Database
          </p>
          <p className="text-xs text-[#1a3a52]/50">
            Tinjau atau hapus dokumen yang tersimpan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            aria-label="Muat ulang daftar dokumen"
            className={`glass-inner rounded-xl p-2 text-[#1a3a52]/50 transition-colors hover:text-[#1a3a52] ${
              loadingDocs ? "cursor-wait opacity-50" : ""
            }`}
          >
            <svg
              className={`h-4 w-4 ${loadingDocs ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <div className="glass-inner rounded-2xl px-3 py-2 text-xs text-[#1a3a52]/60">
            Total: {docs.length}
          </div>
        </div>
      </div>

      <div className="glass-inner min-h-0 flex-1 overflow-hidden rounded-3xl">
        <div className="h-full overflow-y-auto">          {loadingDocs && (
            <div className="flex items-center justify-center p-6">
              <svg className="h-5 w-5 animate-spin text-[#1a6fa8]/50" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
              </svg>
            </div>
          )}

          {!loadingDocs && docs.length === 0 && (
            <div className="flex h-full min-h-64 items-center justify-center p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <svg className="h-7 w-7 text-[#1a6fa8]/60" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 18h8m-4-4v8m8-8-4 4-4-4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#1a3a52]">
                  Belum ada dokumen tersimpan.
                </p>
                <p className="mt-1 text-xs text-[#1a3a52]/50">
                  Upload dokumen untuk mulai mengisi database.
                </p>
              </div>
            </div>
          )}

          {!loadingDocs && docs.length > 0 && (
            <div className="divide-y divide-white/10">
              {docs.map((doc) => (
                <div key={doc.id} className="px-1 py-0">
                  <div className="flex items-center gap-4 p-4 pr-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                      <svg className="h-5 w-5 text-[#1a6fa8]/70" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-60 truncate text-sm font-medium text-[#1a3a52]">
                          {doc.document_name}
                        </p>
                        <span
                          className={`rounded-full bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide ${statusBadgeClass(doc.status)}`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#1a3a52]/45">
                        {formatDate(doc.created_at)}
                        {" · "}
                        {doc.size_human ?? formatBytes(doc.size)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleChunks(doc)}
                        className="rounded-xl px-3 py-2 text-xs text-[#1a6fa8] transition-all hover:bg-white/10"
                      >
                        {openId === doc.id ? "Tutup" : "Chunks"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc)}
                        className="rounded-xl px-3 py-2 text-xs text-rose-500 transition-all hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Panel chunk yang bisa diperluas */}
                  {openId === doc.id && (
                    <div className="px-4 pb-4 pl-[76px]">
                      <div className="max-h-56 overflow-y-auto rounded-2xl bg-white/10 px-4 py-3">
                        {loadingChunks ? (
                          <div className="flex items-center justify-center py-2">
                            <svg className="h-4 w-4 animate-spin text-[#1a6fa8]/50" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
                            </svg>
                          </div>
                        ) : chunks.length === 0 ? (
                          <p className="text-xs text-[#1a3a52]/50">Belum ada chunk.</p>
                        ) : (
                          chunks.map((chunk) => (
                            <p
                              key={chunk.id}
                              className="mb-2 whitespace-pre-wrap border-b border-white/10 pb-2 text-xs leading-relaxed text-[#1a3a52]/70 last:mb-0 last:border-0 last:pb-0"
                            >
                              {chunk.chunk_text}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}</div>
      </div>
    </div>
  );
}


