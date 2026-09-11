"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();
  const isAdmin = user?.role === "admin" && user?.is_staff === true;
  const [historyOpen, setHistoryOpen] = useState(true);
  const [history, setHistory] = useState<
    { id: number; title: string; createdAt: string }[]
  >([]);
  const [newHistoryId, setNewHistoryId] = useState<number | null>(null);
  const [typingHistory, setTypingHistory] = useState<Set<number>>(new Set());
  const newChatRef = useRef<HTMLAnchorElement>(null);
  const typingTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const fetchHistory = (currentIds: Set<number>) => {
    const abortController = new AbortController();
    api
      .get<{
        results: {
          id: number;
          query_detail?: { display_title?: string; created_at?: string };
        }[];
      }>("/history/", {
        signal: abortController.signal,
      })
      .then((data) => {
        const newHistory = Array.isArray(data?.results) ? data.results : [];
        const mapped = newHistory.slice(0, 10).map((h) => ({
          id: h.id,
          title: h.query_detail?.display_title || `Riwayat #${h.id}`,
          createdAt: h.query_detail?.created_at || new Date().toISOString(),
        }));
        setHistory(mapped);
        newHistory.forEach((h) => {
          if (h.id && !currentIds.has(h.id)) {
            setNewHistoryId(h.id);
            const timeoutId = setTimeout(() => {
              setTypingHistory((prev) => new Set(prev).add(h.id));
            }, 100);
            typingTimeouts.current.set(h.id, timeoutId);
          }
        });
      })
      .catch(() => {});
    return abortController;
  };

  useEffect(() => {
    const abortController = fetchHistory(new Set());
    const intervalId = setInterval(() => {
      const currentIds = new Set(history.map((h) => h.id));
      fetchHistory(currentIds);
    }, 5000);
    return () => {
      abortController.abort();
      clearInterval(intervalId);
      typingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeouts.current.clear();
    };
  }, [history]);

  function handleNewChat() {
    setNewHistoryId(null);
    setTypingHistory(new Set());
    window.dispatchEvent(new Event("lumina:new-chat"));
    router.push("/");
    onClose();
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  function getDateGroup(iso: string): "today" | "yesterday" | "older" {
    const date = new Date(iso);
    if (date >= todayStart) return "today";
    if (date >= yesterdayStart) return "yesterday";
    return "older";
  }

  const groupedHistory = {
    today: history.filter((h) => getDateGroup(h.createdAt) === "today"),
    yesterday: history.filter((h) => getDateGroup(h.createdAt) === "yesterday"),
    older: history.filter((h) => getDateGroup(h.createdAt) === "older"),
  };

  const typingTexts: Record<number, string> = {};
  history.forEach((h) => {
    if (typingHistory.has(h.id) && typingTimeouts.current.has(h.id)) {
      typingTexts[h.id] = h.title;
    }
  });

  return (
    <aside
      id="app-sidebar"
className={`fixed inset-y-0 left-0 z-50 flex h-full w-[280px] -translate-x-full flex-col border-r border-white/40 bg-white/65 shadow-[0_8px_32px_rgba(31,38,135,0.1)] backdrop-blur-xl transition-transform duration-300 md:static md:w-72 md:translate-x-0 ${
         isOpen ? "translate-x-0" : "-translate-x-full"
       }`}
    >
      <div className="flex items-center justify-between border-b border-white/40 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center">
            <Image
              src="/images/icons/Logo.png"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              alt="Logo"
            />
          </div>
          <div className="leading-none">
            <p className="text-[18px] font-bold tracking-tight text-blue-900">
              Lumi<span className="text-blue-500">na</span>
            </p>
            <p className="mt-1 text-[11px] text-blue-400">Assistant</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-2">
        <Link
          ref={newChatRef}
          href="/"
          onClick={handleNewChat}
          className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-white/80`}
        >
          <span className="flex h-5 w-5 items-center justify-center">
            <Image
              src="/images/icons/NewChatIcon.png"
              width={18}
              height={18}
              className="h-4.5 w-4.5 opacity-80"
              alt=""
            />
          </span>
          <span>New Chat</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isAdmin && (
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-900">
            Dokumen
          </div>
        )}

        {isAdmin && (
          <Link
            href="/upload"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-white/55 ${
              pathname === "/upload" ? "bg-blue-50/80" : ""
            }`}
          >
            <Image
              src="/images/icons/UploadIcon.png"
              width={18}
              height={18}
              className="h-4.5 w-4.5 opacity-75"
              alt=""
            />
            <span>Upload Dokumen</span>
          </Link>
        )}

        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-900">
          Riwayat Chat
        </div>
        <div className="flex flex-col gap-1 pl-4">
          {groupedHistory.today.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-900/80">
                Hari ini
              </div>
              {groupedHistory.today.map((h) => (
                <Link
                  key={h.id}
                  href="/history"
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-blue-950/70 transition-all hover:bg-white/55 hover:text-blue-700 ${
                    h.id === newHistoryId ? "animate-pulse bg-blue-50/50" : ""
                  }`}
                  title={h.title}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-300/80" />
                  <span className={`truncate ${h.id === newHistoryId ? "typing-animation" : ""}`}>
                    {h.title}
                  </span>
                </Link>
              ))}
            </>
          )}
          {groupedHistory.yesterday.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-900/80">
                Kemarin
              </div>
              {groupedHistory.yesterday.map((h) => (
                <Link
                  key={h.id}
                  href="/history"
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-blue-950/70 transition-all hover:bg-white/55 hover:text-blue-700 ${
                    h.id === newHistoryId ? "animate-pulse bg-blue-50/50" : ""
                  }`}
                  title={h.title}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-300/80" />
                  <span className={`truncate ${h.id === newHistoryId ? "typing-animation" : ""}`}>
                    {h.title}
                  </span>
                </Link>
              ))}
            </>
          )}
          {groupedHistory.older.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-900/80">
                Lebih lama
              </div>
              {groupedHistory.older.map((h) => (
                <Link
                  key={h.id}
                  href="/history"
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-blue-950/70 transition-all hover:bg-white/55 hover:text-blue-700 ${
                    h.id === newHistoryId ? "animate-pulse bg-blue-50/50" : ""
                  }`}
                  title={h.title}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-300/80" />
                  <span className={`truncate ${h.id === newHistoryId ? "typing-animation" : ""}`}>
                    {h.title}
                  </span>
                </Link>
              ))}
            </>
          )}
          {history.length === 0 && (
            <span className="px-3 py-2 text-xs italic text-blue-400/70">
              Belum ada riwayat
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-white/40 px-4 py-4">
        <button
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/55"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)]">
            {user?.username?.slice(0, 1).toUpperCase() || "U"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-blue-950">
              {user?.username || "Pengguna"}
            </span>
            <span className="block truncate text-[11px] text-blue-400 capitalize">
              {user?.role || "member"}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
