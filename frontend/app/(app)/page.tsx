"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { api } from "@/lib/api";

interface Source {
  source: string;
  page: number | null;
  score: number | null;
  excerpt: string;
}

interface AskResponse {
  success: boolean;
  query_id: number;
  answer_id: number | null;
  answer: string;
  response_time_ms: number;
  sources: Source[];
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  responseTimeMs?: number;
}

interface DocumentItem {
  id: number;
  document_name: string;
  size_human: string;
  status: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    // Muat daftar dokumen user untuk info "dokumen yang sudah diindeks".
    api
      .get<Paginated<DocumentItem>>("/documents/")
      .then((data) => setDocuments(data.results))
      .catch(() => setDocuments([]));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage() {
    const text = question.trim();
    if (!text || loading) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: ++idCounter.current,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const data = await api.post<AskResponse>("/ask/", { question: text });
      const assistantMessage: ChatMessage = {
        id: ++idCounter.current,
        role: "assistant",
        content: data.answer,
        sources: data.sources ?? [],
        responseTimeMs: data.response_time_ms,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: ++idCounter.current,
          role: "assistant",
          content:
            err instanceof Error
              ? `⚠️ ${err.message}`
              : "⚠️ Terjadi kesalahan saat memproses pertanyaan.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 px-5 py-4">
        <h1 className="text-lg font-semibold text-[#1a3a52]">Chat</h1>
        {documents.length > 0 && (
          <p className="mt-0.5 text-xs text-[#1a3a52]/50">
            {documents.length} dokumen siap ·{" "}
            {documents.map((d) => d.document_name).join(", ")}
          </p>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-3 py-4 md:space-y-6 md:px-4 md:py-6"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center md:py-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <img src="/images/icons/Logo.png" className="h-7 w-10 opacity-70" alt="Lumina" />
            </div>
            <p className="text-base leading-relaxed text-[#1a3a52]/80">
              Halo! Saya <strong>Lumina</strong>, asisten akademikmu.
              <br />
              Ajukan pertanyaan dan aku akan menjawabnya
              <br />
              sesuai pengetahuanku.
            </p>
            {documents.length === 0 && (
              <p className="max-w-md text-xs text-[#1a3a52]/40">
                Belum ada dokumen terindeks. Hubungi admin untuk mengunggah dokumen
                sebelum mengajukan pertanyaan.
              </p>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 md:gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm md:h-8 md:w-8">
                <img src="/images/icons/Logo.png" className="h-6 w-9 opacity-70 md:h-7 md:w-10" alt="Lumina" />
              </div>
            )}

            <div
              className={`rounded-2xl text-sm ${
                msg.role === "user"
                  ? "max-w-[85%] rounded-tr-sm border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:max-w-2xl md:px-4 md:py-3"
                  : "max-w-[92%] rounded-tl-sm border border-slate-100 bg-white px-3 py-3 shadow-sm md:max-w-2xl md:px-5 md:py-4"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1a3a52]">
                    {msg.content}
                  </p>
                  {msg.responseTimeMs !== undefined && (
                    <p className="mt-2 text-[10px] text-[#1a3a52]/40">
                      Waktu respons: {(msg.responseTimeMs / 1000).toFixed(2)} s
                    </p>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-[#1a6fa8]">
                        Lihat {msg.sources.length} sumber
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {msg.sources.map((source, idx) => (
                          <li
                            key={idx}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                          >
                            <span className="font-semibold">{source.source}</span>
                            <p className="mt-1 line-clamp-3 text-slate-600">
                              {source.excerpt}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <span
                  className="text-[#0f172a]"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, lineHeight: 1.65 }}
                >
                  {msg.content}
                </span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-2 md:gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm md:h-8 md:w-8">
              <img src="/images/icons/Logo.png" className="h-7 w-9 opacity-70" alt="Lumina" />
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a3a52]/60" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a3a52]/60" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1a3a52]/60" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="text-xs text-[#1a3a52]/50">
                {error ? "Terjadi kesalahan, coba lagi." : "Lumina sedang mengetik…"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-3 md:px-5">
        {error && <p className="mb-1 text-xs text-red-500">{error}</p>}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 md:gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ketik pertanyaanmu..."
            spellCheck={false}
            autoComplete="off"
            disabled={loading}
            className="glass-inner max-h-[120px] flex-1 resize-none rounded-xl border border-white/20 bg-transparent px-3 py-2.5 text-[15px] text-black placeholder-black/50 focus:outline-none focus:ring-0 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="glass-inner flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#1a6fa8] transition-all hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40 md:h-12 md:w-12"
            aria-label="Kirim"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 hidden text-center text-[10px] text-black/50 md:mt-2 md:text-xs lg:block">
          Enter untuk kirim · Shift+Enter baris baru
        </p>
      </div>
    </div>
  );
}