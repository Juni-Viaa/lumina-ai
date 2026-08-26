"use client";

import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "Lumina" }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="glass-panel header relative z-50 flex items-center justify-between px-6 py-4">
      <span className="text-base font-medium tracking-tight text-[#1a3a52]">
        {title}
      </span>

      {/* Profile Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="glass-inner flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
          aria-label="Menu profil"
        >
          <svg
            className="h-5 w-5 text-[#1a6fa8]/70"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 top-full z-[9999] mt-4 w-48 rounded-2xl border border-white/10 bg-white py-2 shadow-lg">
            {/* Change Password */}
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#1a3a52] transition-colors hover:bg-[#1a6fa8]/10">
              <svg
                className="h-4 w-4 text-[#1a6fa8]/70"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                />
              </svg>
              <a href="/change-password" onClick={() => setIsOpen(false)}>
                Ganti Password
              </a>
            </div>

            {/* Logout */}
            <div className="w-full px-4 py-2 text-left text-sm text-red-500 transition-colors hover:bg-[#1a6fa8]/10">
              <a href="/logout" onClick={() => setIsOpen(false)}>
                Logout
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}