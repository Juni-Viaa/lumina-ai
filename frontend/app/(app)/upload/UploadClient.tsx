"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface DocumentItem {
  id: number;
  document_name: string;
  size_human?: string | null;
  size: number;
  status: string;
  created_at: string;
}

interface ChunkItem {
  id: number;
  chunk_text: string;
}

interface IngestLogItem {
  id: number;
  step: string;
  message: string;
  created_at: string;
}

type DocsPayload = DocumentItem[] | { results?: DocumentItem[] };
type OpenDetail = { documentId: number; type: "chunks" | "logs" } | null;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
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
  const isAdmin = user?.role === "admin" && user.is_staff === true;

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#1a3a52]/70">
        Anda tidak memiliki izin untuk mengakses halaman upload.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/10 px-5 pt-5">
        <h3 className="text-lg font-semibold leading-tight text-[#1a3a52]">Manajemen Dokumen</h3>
      </div>
      <ManageSection />
    </div>
  );
}

function ManageSection() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [search, setSearch] = useState("");
  const [openDetail, setOpenDetail] = useState<OpenDetail>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [logs, setLogs] = useState<IngestLogItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const docRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  function applyDocs(payload: DocsPayload) {
    setDocs(Array.isArray(payload) ? payload : (payload.results ?? []));
  }

  async function refreshDocs() {
    setLoadingDocs(true);
    try {
      applyDocs(await api.get<DocsPayload>("/documents/"));
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    void refreshDocs();
  }, []);

  const recentDocs = useMemo(
    () =>
      docs
        .filter((doc) => doc.document_name.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [docs, search],
  );

  async function toggleDetail(doc: DocumentItem, type: "chunks" | "logs") {
    if (openDetail?.documentId === doc.id && openDetail.type === type) {
      setOpenDetail(null);
      return;
    }

    setOpenDetail({ documentId: doc.id, type });
    setLoadingDetail(true);
    try {
      if (type === "chunks") {
        const data = await api.get<ChunkItem[]>(`/documents/${doc.id}/chunks/`);
        setChunks(Array.isArray(data) ? data : []);
      } else {
        const data = await api.get<IngestLogItem[]>(`/documents/${doc.id}/ingest_logs/`);
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      if (type === "chunks") setChunks([]);
      else setLogs([]);
    } finally {
      setLoadingDetail(false);
      setTimeout(() => {
        const el = docRefs.current.get(doc.id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }

  async function handleDelete(doc: DocumentItem) {
    if (!window.confirm(`Hapus dokumen "${doc.document_name}" beserta seluruh chunk-nya?`)) return;
    try {
      await api.delete(`/documents/${doc.id}/`);
      if (openDetail?.documentId === doc.id) setOpenDetail(null);
      await refreshDocs();
    } catch {
      return;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
      <div className="shrink-0 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl p-4 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[#1a3a52]/50">Total Dokumen</p>
          <p className="mt-2 text-3xl font-semibold text-[#1a3a52]">{docs.length}</p>
        </div>
        <div className="rounded-2xl p-4 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[#1a3a52]/50">Total Chunk</p>
          <p className="mt-2 text-3xl font-semibold text-[#1a3a52]">-</p>
          <p className="mt-1 text-xs text-[#1a3a52]/45">Total chunk dimuat saat detail dokumen dibuka.</p>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
        <svg className="h-5 w-5 shrink-0 text-[#1a3a52]/45" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari dokumen..."
          className="w-full bg-transparent text-sm text-[#1a3a52] outline-none placeholder:text-[#1a3a52]/40"
        />
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#1a3a52]">Dokumen Terbaru</p>
          <p className="text-xs text-[#1a3a52]/50">Menampilkan maksimal 5 dokumen yang terakhir di-ingest.</p>
        </div>
        <button type="button" onClick={() => void refreshDocs()} className="rounded-xl px-3 py-2 text-xs text-[#1a6fa8] transition-colors hover:bg-white/15">
          Muat ulang
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl [background:rgba(255,255,255,0.1)] [border:1px_solid_rgba(255,255,255,0.18)] [box-shadow:0_2px_4px_rgba(0,0,0,0.15)] [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]">
        {loadingDocs ? (
          <div className="p-6 text-center text-sm text-[#1a3a52]/50">Memuat dokumen...</div>
        ) : recentDocs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#1a3a52]/50">Tidak ada dokumen yang ditemukan.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/10">
            {recentDocs.map((doc) => (
              <div key={doc.id} ref={(el) => { if (el) docRefs.current.set(doc.id, el); else docRefs.current.delete(doc.id); }} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#1a3a52]">{doc.document_name}</p>
                      <span className={`rounded-full bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide ${statusBadgeClass(doc.status)}`}>{doc.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#1a3a52]/45">{formatDate(doc.created_at)} · {doc.size_human ?? formatBytes(doc.size)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void toggleDetail(doc, "chunks")} className="rounded-xl px-3 py-2 text-xs text-[#1a6fa8] transition-all hover:bg-white/15">
                      {openDetail?.documentId === doc.id && openDetail.type === "chunks" ? "Tutup Chunk" : "Lihat Chunk"}
                    </button>
                    <button type="button" onClick={() => void toggleDetail(doc, "logs")} className="rounded-xl px-3 py-2 text-xs text-orange-500 transition-all hover:bg-orange-500/10">
                      {openDetail?.documentId === doc.id && openDetail.type === "logs" ? "Tutup Ingest" : "Ingest"}
                    </button>
                    <button type="button" onClick={() => void handleDelete(doc)} className="rounded-xl px-3 py-2 text-xs text-rose-500 transition-all hover:bg-rose-500/10">Delete</button>
                  </div>
                </div>

                {openDetail?.documentId === doc.id && (
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl bg-white/10 p-3">
                    {loadingDetail ? (
                      <p className="text-xs text-[#1a3a52]/50">Memuat data...</p>
                    ) : openDetail.type === "chunks" ? (
                      chunks.length === 0 ? <p className="text-xs text-[#1a3a52]/50">Belum ada chunk.</p> : chunks.map((chunk, index) => (
                        <div key={chunk.id} className="mb-3 border-b border-white/10 pb-3 last:mb-0 last:border-0 last:pb-0">
                          <p className="mb-1 text-xs font-semibold text-[#1a6fa8]">Chunk {index + 1}</p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#1a3a52]/70">{chunk.chunk_text}</p>
                        </div>
                      ))
                    ) : logs.length === 0 ? <p className="text-xs text-[#1a3a52]/50">Belum ada log ingest.</p> : logs.map((log) => (
                      <div key={log.id} className="grid gap-1 border-b border-white/10 py-2 text-xs last:border-0">
                        <p className="text-[#1a3a52]/45">{formatDate(log.created_at)}</p>
                        <p className="font-medium text-[#1a3a52]">Proses: {log.step}</p>
                        <p className="text-[#1a3a52]/70">Hasil: {log.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
