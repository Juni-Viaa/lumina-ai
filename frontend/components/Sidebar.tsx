"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

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

        {/* Riwayat Chat */}
        <Link
          href="/history"
          onClick={onClose}
          className={`sidebar-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
            isActive("/history") ? "sidebar-nav-active" : ""
          }`}
        >
          <Image
            src="/images/icons/HistoryIcon.png"
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 opacity-70"
            alt=""
          />
          <span className="nav-label hidden text-sm text-black/80 lg:block">
            Riwayat Chat
          </span>
        </Link>
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