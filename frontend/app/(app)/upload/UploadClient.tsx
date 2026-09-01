"use client";

/**
 * Halaman Upload & Manage — hasil adaptasi desain Blade (Laravel) ke React/Tailwind:
 * upload cepat (hanya simpan dokumen), lalu proses ingest dipantau di tab Ingesting.
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

interface UploadResponse {
  message: string;
  document_id: number;
  session_id?: string | null;
}

interface DocumentItem {
  id: number;
  document_name: string;
  size_human?: string | null;
  size: number;
  status: string;
  created_at: string;
  ingest_session_id?: string | null;
}

type DocsPayload = DocumentItem[] | { results?: DocumentItem[] };

interface IngestLogItem {
  id: number;
  step: string;
  message: string;
  created_at: string;
}

interface IngestStatusResponse {
  logs: IngestLogItem[];
  status: string;
}

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

function stepLabel(step: string): string {
  if (step === "complete") return "Ready";
  return step;
}

export default function UploadPage() {
  const router = useRouter();
  const user = getUser();
  const isAdmin = user?.role === "admin" && user?.is_staff === true;
  const [tab, setTab] = useState<"upload" | "manage" | "ingesting">("upload");

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
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 pb-3 pt-5">
        <h3 className="text-lg font-semibold leading-tight text-[#1a3a52]">
          Upload & Manage
        </h3>
        <div className="glass-inner inline-flex rounded-2xl p-1">
          {(
            [
              ["upload", "Upload"],
              ["manage", "Dokumen"],
              ["ingesting", "Ingesting"],
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

      {tab === "upload" && <UploadSection onUploadComplete={() => setTab("ingesting")} />}
      {tab === "manage" && <ManageSection onViewIngest={() => setTab("ingesting")} />}
      {tab === "ingesting" && <IngestSection />}
    </div>
  );
}

function UploadSection({ onUploadComplete }: { onUploadComplete: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<UploadErrorState | null>(null);

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

  async function submitUpload() {
    if (!file || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const data = await api.uploadFile<UploadResponse>("/ingest/upload/", formData);
      setResult(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploadComplete();
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
      <div className="flex min-h-0 flex-1 px-5 py-4">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />

        {!file && !uploading && !result && !error && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onSelect(e.dataTransfer.files?.[0] ?? null);
            }}
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V8m0 0-3 3m3-3 3 3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-[#1a3a52]">Tarik & lepas dokumen di sini</p>
                <p className="mt-1 text-sm text-[#1a3a52]/50">atau klik untuk memilih file dari perangkatmu</p>
              </div>
            </div>
          </div>
        )}

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
                  <p className="truncate text-sm font-medium text-[#1a3a52]">{file.name}</p>
                  <p className="text-xs text-[#1a3a52]/50">{formatBytes(file.size)}</p>
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

        {uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm text-center text-sm text-[#1a3a52]/70">
              Menyimpan dokumen...
            </div>
          </div>
        )}

        {result && !uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15">
                <svg
                  className="h-7 w-7 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mb-1 text-base font-semibold text-[#1a3a52]">Upload berhasil!</p>
              <p className="text-sm text-[#1a3a52]/50">
                {result.message || "Dokumen sedang diproses oleh Lumina."}
              </p>
              <p className="mt-1 text-xs text-[#1a3a52]/45">ID dokumen: {result.document_id}</p>
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

        {error && !uploading && (
          <div className="glass-inner flex h-full w-full items-center justify-center rounded-3xl px-5">
            <div className="w-full max-w-sm text-center">
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
        )}
      </div>
    </div>
  );
}

function ManageSection({ onViewIngest }: { onViewIngest: () => void }) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  function applyDocs(payload: DocsPayload) {
    setDocs(Array.isArray(payload) ? payload : (payload.results ?? []));
  }

  useEffect(() => {
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
    if (!window.confirm(`Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`)) return;
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#1a3a52]">Dokumen di Database</p>
          <p className="text-xs text-[#1a3a52]/50">Tinjau atau hapus dokumen yang tersimpan.</p>
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
          <div className="glass-inner rounded-2xl px-3 py-2 text-xs text-[#1a3a52]/60">Total: {docs.length}</div>
        </div>
      </div>

      <div className="glass-inner min-h-0 flex-1 overflow-hidden rounded-3xl">
        <div className="h-full overflow-y-auto">
          {loadingDocs && (
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
                <p className="text-sm font-medium text-[#1a3a52]">Belum ada dokumen tersimpan.</p>
                <p className="mt-1 text-xs text-[#1a3a52]/50">Upload dokumen untuk mulai mengisi database.</p>
              </div>
            </div>
          )}

          {!loadingDocs && docs.length > 0 && (
            <div className="divide-y divide-white/10">
              {docs.map((doc) => (
                <div key={doc.id} className="px-1 py-0">
                  <div className="flex items-center gap-4 p-4 pr-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                      <svg
                        className="h-5 w-5 text-[#1a6fa8]/70"
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-60 truncate text-sm font-medium text-[#1a3a52]">{doc.document_name}</p>
                        <span
                          className={`rounded-full bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide ${statusBadgeClass(doc.status)}`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#1a3a52]/45">
                        {formatDate(doc.created_at)} · {doc.size_human ?? formatBytes(doc.size)}
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
                        onClick={() => onViewIngest()}
                        className="rounded-xl px-3 py-2 text-xs text-orange-500 transition-all hover:bg-orange-500/10"
                      >
                        Ingest
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

                  {openId === doc.id && (
                    <div className="px-4 pb-4 pl-[76px]">
                      <div className="max-h-56 overflow-y-auto rounded-2xl bg-white/10 px-4 py-3">
                        {loadingChunks ? (
                          <div className="flex items-center justify-center py-2">
                            <svg
                              className="h-4 w-4 animate-spin text-[#1a6fa8]/50"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
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
          )}
        </div>
      </div>
    </div>
  );
}

function IngestSection() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [ingestLogs, setIngestLogs] = useState<IngestLogItem[]>([]);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .get<DocsPayload>("/documents/")
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : (payload.results ?? []);
        setDocs(list.filter((doc) => doc.status === "processing" || doc.ingest_session_id));
      })
      .catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function pollIngest(doc: DocumentItem, afterId = 0) {
    if (!doc.ingest_session_id) return;
    setSelectedDoc(doc);
    setPolling(true);
    setError(null);
    try {
        const data = await api.get<IngestStatusResponse>(`/ingest/status/${doc.id}/?session=${doc.ingest_session_id}&after=${afterId}`);
      const newLogs = Array.isArray(data.logs) ? data.logs : [];
      setIngestLogs((prev) => {
        const merged = afterId === 0 ? newLogs : [...prev, ...newLogs];
        return merged.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
      });
      setIngestStatus(data.status);
      if (data.status === "processing") {
        timerRef.current = window.setTimeout(
          () => pollIngest(doc, newLogs.length ? newLogs[newLogs.length - 1].id : afterId),
          1000,
        );
      } else {
        setPolling(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status ingest.");
      setPolling(false);
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

  async function handleDelete(doc: DocumentItem) {
    if (!window.confirm(`Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`)) return;
    try {
      await api.delete(`/documents/${doc.id}/`);
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
        setIngestLogs([]);
        setIngestStatus(null);
      }
      const refreshed = await api.get<DocsPayload>("/documents/");
      const list = Array.isArray(refreshed) ? refreshed : (refreshed.results ?? []);
      setDocs(list.filter((d) => d.status === "processing" || d.ingest_session_id));
    } catch {
      // Biarkan daftar apa adanya bila penghapusan gagal.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#1a3a52]">Ingest Monitoring</p>
          <p className="text-xs text-[#1a3a52]/50">
            Pantau proses ingest secara real-time dari dokumen yang sedang diproses.
          </p>
        </div>
      </div>

      <div className="glass-inner min-h-0 flex-1 overflow-hidden rounded-3xl">
        <div className="grid h-full min-h-0 grid-cols-[1fr_1.2fr] gap-0">
          <div className="overflow-y-auto border-r border-white/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1a3a52]/50">
              Dokumen Processing
            </p>
            {docs.length === 0 ? (
              <p className="text-xs text-[#1a3a52]/50">Tidak ada dokumen yang sedang diproses.</p>
            ) : (
              docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => void pollIngest(doc)}
                  className={`mb-2 w-full rounded-2xl px-3 py-3 text-left transition-all ${
                    selectedDoc?.id === doc.id ? "bg-white/25" : "bg-white/10 hover:bg-white/15"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-[#1a3a52]">{doc.document_name}</p>
                  <p className="text-xs text-[#1a3a52]/50">
                    {doc.status} · {doc.ingest_session_id}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="overflow-y-auto p-4">
            {!selectedDoc ? (
              <div className="flex h-full items-center justify-center text-sm text-[#1a3a52]/50">
                Pilih dokumen untuk melihat proses ingest.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a3a52]">{selectedDoc.document_name}</p>
                    <p className="text-xs text-[#1a3a52]/50">
                      Status: {ingestStatus ?? selectedDoc.status}
                    </p>
                  </div>
                  {polling && <span className="text-xs text-[#1a6fa8]">Memantau...</span>}
                </div>

                {error && <p className="text-xs text-rose-500">{error}</p>}

                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1a3a52]/50">Log Ingest</p>
                  {ingestLogs.length === 0 ? (
                    <p className="text-xs text-[#1a3a52]/50">Belum ada log.</p>
                  ) : (
                    ingestLogs.map((log) => (
                      <div
                        key={log.id}
                        className="mb-2 border-b border-white/10 pb-2 last:mb-0 last:border-0 last:pb-0"
                      >
                        <p className="text-[10px] uppercase text-[#1a3a52]/40">{stepLabel(log.step)}</p>
                        <p className="text-sm text-[#1a3a52]/80">{log.message}</p>
                        <p className="text-[10px] text-[#1a3a52]/40">{formatDate(log.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => void toggleChunks(selectedDoc)}
                    className="rounded-xl px-3 py-2 text-xs text-[#1a6fa8] transition-all hover:bg-white/10"
                  >
                    {openId === selectedDoc.id ? "Tutup" : "Chunks"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selectedDoc)}
                    className="rounded-xl px-3 py-2 text-xs text-rose-500 transition-all hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                </div>

                {openId === selectedDoc.id && (
                  <div className="rounded-2xl bg-white/10 p-3">
                    {loadingChunks ? (
                      <div className="flex items-center justify-center py-2">
                        <svg
                          className="h-4 w-4 animate-spin text-[#1a6fa8]/50"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
