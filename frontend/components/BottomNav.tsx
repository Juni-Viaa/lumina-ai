"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { getUser } from "@/lib/auth";

export default function BottomNav() {
  const pathname = usePathname();
  const user = getUser();
  const isAdmin = user?.role === "admin" && user?.is_staff === true;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav id="bottom-nav" className="md:hidden">
      {/* New Chat */}
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all ${
          isActive("/") && !isActive("/history")
            ? "text-[#1a6fa8]"
            : "text-[#1a3a52]/70 hover:text-[#1a3a52]"
        }`}
      >
        <Image
          src="/images/icons/NewChatIcon.png"
          width={20}
          height={20}
          className="h-5 w-5 opacity-70"
          alt=""
        />
        <span className="text-[10px] font-medium">Chat</span>
      </Link>

      {/* Upload — admin only */}
      {isAdmin && (
        <Link
          href="/upload"
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all ${
            isActive("/upload")
              ? "text-[#1a6fa8]"
              : "text-[#1a3a52]/70 hover:text-[#1a3a52]"
          }`}
        >
          <Image
            src="/images/icons/UploadIcon.png"
            width={20}
            height={20}
            className="h-5 w-5 opacity-70"
            alt=""
          />
          <span className="text-[10px] font-medium">Upload</span>
        </Link>
      )}

      {/* History */}
      <Link
        href="/history"
        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all ${
          isActive("/history")
            ? "text-[#1a6fa8]"
            : "text-[#1a3a52]/70 hover:text-[#1a3a52]"
        }`}
      >
        <Image
          src="/images/icons/HistoryIcon.png"
          width={20}
          height={20}
          className="h-5 w-5 opacity-70"
          alt=""
        />
        <span className="text-[10px] font-medium">Riwayat</span>
      </Link>
    </nav>
  );
}