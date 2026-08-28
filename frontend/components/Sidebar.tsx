"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = getUser();
  const isAdmin = user?.role === "admin" && user?.is_staff === true;
  const [historyOpen, setHistoryOpen] = useState(true);
  const [history, setHistory] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    const abortController = new AbortController();
    api
      .get<{ results: { id: number; query_detail?: { display_title?: string } }[] }>("/history/", {
        signal: abortController.signal,
      })
      .then((data) =>
        setHistory(
          (Array.isArray(data?.results) ? data.results : []).slice(0, 5).map((h) => ({
            id: h.id,
            title: h.query_detail?.display_title || `Riwayat #${h.id}`,
          })),
        ),
      )
      .catch(() => setHistory([]));
    return () => abortController.abort();
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <aside
      id="app-sidebar"
      className={`glass-panel sidebar flex h-full shrink-0 flex-col gap-2 px-3 py-4 md:w-56 md:px-4 md:py-5 lg:w-60 ${
        isOpen ? "open" : ""
      }`}
    >
      {/* Logo */}
      <div className="sidebar-logo-wrap mb-3 flex items-center gap-2 px-1">
        <div className="glass-inner flex h-9 w-full items-center overflow-hidden rounded-lg leading-none">
          <Image
            src="/images/icons/Logo.png"
            width={48}
            height={32}
            className="h-8 w-12 shrink-0 opacity-70"
            alt="Logo"
          />
          <span className="sidebar-brand-name hidden text-base font-semibold tracking-tight text-[#1a3a52] md:hidden lg:block">
            Lumina
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {/* New Chat */}
        <Link
          href="/"
          onClick={onClose}
          className={`sidebar-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
            isActive("/") && !isActive("/history") ? "sidebar-nav-active" : ""
          }`}
        >
          <Image
            src="/images/icons/NewChatIcon.png"
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 opacity-70"
            alt=""
          />
          <span className="nav-label hidden text-sm text-black/80 lg:block">
            New Chat
          </span>
        </Link>

        {/* Upload — admin only */}
        {isAdmin && (
          <Link
            href="/upload"
            onClick={onClose}
            className={`sidebar-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
              isActive("/upload") ? "sidebar-nav-active" : ""
            }`}
          >
            <Image
              src="/images/icons/UploadIcon.png"
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 opacity-70"
              alt=""
            />
            <span className="nav-label hidden text-sm text-black/80 lg:block">
              Upload Dokumen
            </span>
          </Link>
        )}

        {/* Riwayat Chat */}
        <div className="history-section">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="sidebar-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
          >
            <Image
              src="/images/icons/HistoryIcon.png"
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 opacity-70"
              alt=""
            />
            <span className="nav-label hidden flex-1 text-left text-sm text-black/80 lg:block">
              Riwayat Chat
            </span>
            <Image
              src="/images/icons/DropDownIcon.png"
              width={14}
              height={14}
              className={`nav-label h-3.5 w-3.5 hidden opacity-50 transition-transform duration-200 lg:block ${
                historyOpen ? "rotate-180" : ""
              }`}
              alt=""
            />
          </button>

          {historyOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-10">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href="/history"
                  onClick={onClose}
                  className="block truncate rounded-lg px-2 py-1.5 text-xs text-[#1a3a52]/60 transition-all hover:bg-white/20 hover:text-[#1a3a52]/90"
                  title={h.title}
                >
                  {h.title}
                </Link>
              ))}
              {history.length === 0 && (
                <span className="px-2 py-1 text-xs italic text-[#1a3a52]/40">
                  Belum ada riwayat
                </span>
              )}
              <Link href="/history" onClick={onClose} className="flex justify-end px-4 pt-1">
                <button className="text-xs text-[#1a3a52]/35 transition-colors hover:text-[#1a3a52]/60">
                  Lihat semua
                </button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile close button */}
      <button
        onClick={onClose}
        className="mt-auto rounded-lg p-2 text-left text-sm text-[#1a3a52]/60 transition-colors hover:bg-white/20 md:hidden"
      >
        ✕ Tutup
      </button>
    </aside>
  );
}