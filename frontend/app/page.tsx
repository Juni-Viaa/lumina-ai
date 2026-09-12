"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

interface DocItem {
  id: number;
  document_name: string;
  file_type: string;
  size: number;
  file_size_mb: number;
  status: string;
  is_ocr: boolean;
  created_at: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try {
      const data = await api.get<{ results: DocItem[] }>("/documents/");
      setDocs(data.results);
    } catch { setError("Gagal memuat daftar dokumen."); }
    finally { setLoading(false); }
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const data = await api.uploadFile<DocItem>("/documents/", formData);
      // Auto trigger ingest
      await api.post(`/documents/${data.id}/ingest/`, {});
      loadDocs();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Upload gagal."); }
    finally { setUploading(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus dokumen ini?")) return;
    try { await api.delete(`/documents/${id}/delete/`); loadDocs(); }
    catch { setError("Gagal menghapus."); }
  }

  if (loading) return <div className="flex items-center justify-center h-full">Memuat...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dokumen Saya</h1>
      <form onSubmit={handleUpload} className="mb-8">
        <div className="border-2 border-dashed rounded-xl p-8 text-center">
          <input type="file" name="file" className="hidden" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.bmp,.tiff,.webp" />
          <p className="text-gray-600">Seret file atau <span className="text-blue-600 underline">pilih</span></p>
          <p className="text-xs text-gray-400 mt-2">PDF, DOCX, TXT, JPG, PNG (maks 100MB)</p>
          <button type="submit" disabled={uploading} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {uploading ? "Upload..." : "Upload"}
          </button>
        </div>
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
      </form>
      <div className="grid gap-4">
        {docs.length === 0 ? <p className="text-gray-500 text-center py-8">Belum ada dokumen.</p> :
          docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
              <div>
                <p className="font-medium">{doc.document_name}</p>
                <p className="text-xs text-gray-500">{doc.file_size_mb} MB · {doc.file_type.toUpperCase()} · {doc.is_ocr ? "🖼️ OCR" : "📄"} · <span className={doc.status === "indexed" ? "text-green-600" : "text-yellow-600"}>{doc.status}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => api.post(`/documents/${doc.id}/ingest/`, {})} disabled={doc.status === "indexed"} className="px-3 py-1 text-sm bg-green-600 text-white rounded disabled:opacity-50">
                  {doc.status === "indexed" ? "✓" : "Indeks"}
                </button>
                <button onClick={() => handleDelete(doc.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Hapus</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
