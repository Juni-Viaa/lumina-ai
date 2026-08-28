"use client";

/**
 * Form Ganti Password — porting dari components/password-form.blade.php:
 * baris input glass tanpa label, toggle tampil/sembunyi, ring merah saat
 * konfirmasi tidak cocok, tombol Batal/Simpan, dan toast sukses kanan-bawah.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";

interface ChangePasswordResponse {
  detail?: string;
}

interface ShowMap {
  old: boolean;
  new: boolean;
  confirm: boolean;
}

export default function PasswordClient() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState<ShowMap>({ old: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !mismatch;

  function toggle(field: keyof ShowMap) {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!canSubmit) return;
    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }

    setSaving(true);
    try {
      await api.post<ChangePasswordResponse>("/auth/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      clearAuth();
      setSuccess(true);
      // Password berubah — paksa login ulang.
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan sistem.",
      );
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel h-full overflow-hidden">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex h-full flex-col px-6 py-8"
      >
        {/* Spacer atas */}
        <div className="flex-1" />

        {error && (
          <p className="mb-3 px-1 text-xs text-red-500">{error}</p>
        )}

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          {/* Password Lama */}
          <div className="glass-inner flex items-center rounded-2xl px-5 py-4">
            <input
              type={show.old ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Password Lama"
              autoComplete="current-password"
              className="flex-1 border-none bg-transparent text-sm text-[#1a3a52]/70 outline-none placeholder:text-[#1a3a52]/50"
            />
            <button
              type="button"
              onClick={() => toggle("old")}
              aria-label={
                show.old ? "Sembunyikan password" : "Tampilkan password"
              }
              className="ml-2 text-[#1a3a52]/30 transition-colors hover:text-[#1a3a52]/60"
            >
              {show.old ? (
                <EyeSlashIcon />
              ) : (
                <EyeIcon />
              )}
            </button>
          </div>

          {/* Password Baru */}
          <div className="glass-inner flex items-center rounded-2xl px-5 py-4">
            <input
              type={show.new ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password Baru"
              autoComplete="new-password"
              className="flex-1 border-none bg-transparent text-sm text-[#1a3a52]/70 outline-none placeholder:text-[#1a3a52]/50"
            />
            <button
              type="button"
              onClick={() => toggle("new")}
              aria-label={
                show.new ? "Sembunyikan password" : "Tampilkan password"
              }
              className="ml-2 text-[#1a3a52]/30 transition-colors hover:text-[#1a3a52]/60"
            >
              {show.new ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Konfirmasi Password */}
          <div
            className={`glass-inner flex items-center rounded-2xl px-5 py-4 ${
              mismatch ? "ring-1 ring-red-400/40" : ""
            }`}
          >
            <input
              type={show.confirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi Password Baru"
              autoComplete="new-password"
              className="flex-1 border-none bg-transparent text-sm text-[#1a3a52]/70 outline-none placeholder:text-[#1a3a52]/50"
            />
            <button
              type="button"
              onClick={() => toggle("confirm")}
              aria-label={
                show.confirm ? "Sembunyikan password" : "Tampilkan password"
              }
              className="ml-2 text-[#1a3a52]/30 transition-colors hover:text-[#1a3a52]/60"
            >
              {show.confirm ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
          </div>

          {mismatch && (
            <p className="-mt-2 px-1 text-xs text-red-400/70">
              Password tidak cocok.
            </p>
          )}
        </div>

        {/* Spacer bawah */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="glass-inner rounded-2xl px-6 py-2.5 text-sm text-[#1a3a52]/70 transition-all hover:bg-white/25"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="glass-inner rounded-2xl px-6 py-2.5 text-sm font-medium text-[#1a3a52] transition-all hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>

      {/* Success Toast */}
      {success && (
        <div className="glass-inner fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm text-emerald-600">
          ✓ Password berhasil diubah.
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  );
}

