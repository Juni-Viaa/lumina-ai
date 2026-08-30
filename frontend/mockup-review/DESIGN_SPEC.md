# Lumina — Glassmorphism Refresh (Blue & White)

Dokumen ini menjelaskan rancangan UI pengganti untuk aplikasi Lumina (frontend
Next.js 16 + Tailwind CSS 4). Tujuan: menyegarkan tampilan glassmorphism yang
sudah ada dengan fokus pada warna biru & putih, depth yang lebih jelas, dan
micro-interactions yang lebih hidup — tanpa mengubah perilaku atau API call
yang sudah ada.

> **File mockup (HTML statis, tidak mengubah kode produksi) ada di:**
> - `mockup-login-split.html`   **(baru)**
> - `mockup-register-split.html` **(baru)**
> - `mockup-dashboard.html`  (Chat)
> - `mockup-upload.html`     (Upload & Manage)
> - `mockup-history.html`    (Riwayat Pertanyaan)
> - `mockup-change-password.html`

---

## 0. Branding & Logo

**Logo file**: `D:\Project\Django\lumina\frontend\public\images\icons\Logo.png` (22.6KB PNG)
- Disalurkan ke `C:\Users\junio\.workbuddy-ai\Logo_lumina.png` untuk akses global WorkBuddy AI.
- Semua halaman autentikasi (`/login`, `/register`) serta sidebar menggunakan `<img src="/images/icons/Logo.png" ...>` atau `background: url('/images/icons/Logo.png')`.
- Warna primer desain (biru `#1E5FBF` dan cyan `#52B6FF`) diturunkan dari palette_logo; warna highlight diambil dari warna dominant logo.

### 0.1 Penempatan Logo per Halaman

- **Login (`/login`)**: `div.brand-circle > div.logo` di tengah atas card, radius 24px, dengan background gambar Logo.png.
- **Register (`/register`)**: Sama seperti Login, logo di sudut kiri atas header.
- **Sidebar (global)**: `div.brand > div.brand-mark` menampilkan potongan kecil Logo.png (32×32px) di setiap halaman.
- **Semua halaman lainnya**: Logo juga muncul di `topbar` atau `header` sebagai identitas merk.

### 0.2 Warna dari Logo

- `--blue-600: #1E5FBF` — warna biru utama dari gradient logo.
- `--blue-700: #0F3F95` — warna biru gelap untuk hover/teks aktif.
- `--accent-cyan: #52B6FF` — warna cyan highlight dari detail logo.
- Semua warna token di section 1.1 berasal dari pengambilan warna ini.

---

## 1. Design Tokens

### 1.1 Color Palette (Blue & White)

| Token | Hex | Penggunaan |
|---|---|---|
| `--bg-sky-50` | `#EAF4FF` | Gradient paling atas (paling terang) |
| `--bg-sky-200` | `#BFD9F5` | Gradient tengah (warna utama latar) |
| `--bg-sky-400` | `#7CB1E5` | Gradient bawah + ambient orb |
| `--blue-600` | `#1E5FBF` | Primary CTA, link aktif |
| `--blue-700` | `#0F3F95` | Hover primary, judul kuat |
| `--blue-50` | `#F0F7FF` | Glass panel tint |
| `--ink-900` | `#0A2540` | Teks utama |
| `--ink-700` | `#23456B` | Teks sekunder |
| `--ink-500` | `#5A7592` | Placeholder, label |
| `--white` | `#FFFFFF` | Teks di atas tombol gelap, glass highlight |
| `--accent-cyan` | `#52B6FF` | Glow ring, focus border |
| `--success` | `#18B487` | Status "terjawab / indexed" |
| `--warning` | `#E6A93B` | Status "processing / pending" |
| `--danger` | `#E2506A` | Status "failed", hapus |

### 1.2 Glass Tokens (menggantikan `glass-panel` & `glass-inner`)

| Class | Background | Border | Blur | Shadow |
|---|---|---|---|---|
| `.glass-floating` | `rgba(255,255,255,0.55)` | `1px solid rgba(255,255,255,0.65)` | `28px` | `0 16px 40px -8px rgba(15,63,149,0.18)` |
| `.glass-card` | `rgba(255,255,255,0.42)` | `1px solid rgba(255,255,255,0.55)` | `20px` | `0 8px 24px -6px rgba(15,63,149,0.14)` |
| `.glass-input` | `rgba(255,255,255,0.5)` | `1px solid rgba(255,255,255,0.6)` | `12px` | inset highlight 1px top |
| `.glass-button` | `linear-gradient(180deg, #2C6FE0 0%, #0F3F95 100%)` | `1px solid rgba(255,255,255,0.25)` | `12px` | `0 8px 20px -6px rgba(30,95,191,0.55)` |
| `.glass-button-ghost` | `rgba(255,255,255,0.45)` | `1px solid rgba(255,255,255,0.55)` | `12px` | none, hover `rgba(255,255,255,0.65)` |

### 1.3 Typography

- Tetap **Space Grotesk** (sudah dipakai).
- Skala baru (lebih berani untuk heading, tetap readable untuk body):
  - `display`: 32 / 700 / -0.02em
  - `h1`: 22 / 600 / -0.01em
  - `h2`: 17 / 600
  - `body`: 14 / 450 / 1.55
  - `caption`: 12 / 500
  - `micro`: 11 / 500 / tracking 0.04em / uppercase

### 1.4 Radius & Spacing

- Radius: `12` (control), `16` (input), `20` (card), `28` (panel besar).
- Spacing: tetap 4-based scale Tailwind.

### 1.5 Elevation & Effects

- **Ambient background**: radial-gradient + 2 floating blurred orbs (cyan & sky)
  di belakang layout, parallax halus.
- **Inner highlight** di setiap glass: `inset 0 1px 0 rgba(255,255,255,0.85)`
  (sudah dipakai di `guest-glass-inner`, kita perluas).
- **Focus ring**: 2px outer glow `rgba(82,182,255,0.55)` + 1px inner border `--accent-cyan`.

---

## 2. Layout & Komponen per Halaman

### 2.1 Login (`/login`)
- Centered single card (max-w 420px), tinggi auto.
- Header strip: gradient `--blue-600` → `--blue-700` + tulisan "Masuk" putih.
- Logo glass circle 88px di tengah, di atas border.
- Input: glass-input, 2 baris (Email, Password) + link "Lupa password?".
- Tombol utama: `glass-button` lebar penuh.
- Footer link: "Belum punya akun? Daftar".
- Toggle: "Ingat saya" di atas tombol.
- Background: ambient orbs + sky gradient.

### 2.2 Register (`/register`)
- Struktur sama dengan Login, dengan field tambahan: Nama, Email, Password, Konfirmasi.
- Checkbox "Saya menyetujui Syarat & Ketentuan" di atas tombol.

### 2.3 Dashboard / Chat (`/`)
- **Layout 3-kolom virtual** dengan sidebar kiri (240px desktop, 64px tablet, drawer mobile).
- **Top bar**: glass-floating 64px tinggi, judul "Chat" + info dokumen + profile dropdown.
- **Chat area** (tengah, scrollable):
  - Empty state: ilustrasi orb (radial gradient) + greeting text + suggestion chips.
  - Message bubble user: glass-card right-aligned, white tint 60%.
  - Message bubble assistant: glass-card left-aligned, avatar logo di kiri, fade-in animation.
  - Source chips di bawah assistant message (klik expand).
- **Composer** (bottom, fixed):
  - Glass-input besar dengan placeholder "Tanyakan sesuatu…".
  - Tombol kirim bulat di kanan, gradient blue.
  - Hint: "Enter untuk kirim · Shift+Enter baris baru".

### 2.4 Upload (`/upload`) — admin only
- Top bar sama dengan Dashboard.
- 3 tab di kanan atas (glass segmented control): Upload · Dokumen · Ingesting.
- **Tab Upload**:
  - Drop zone (dashed border cyan, hover glow).
  - Saat file dipilih: glass-card dengan ikon file + meta + tombol "Kirim" / "Hapus".
  - Success state: glass-card dengan centang hijau + tombol "Upload lagi".
- **Tab Dokumen**:
  - List of document rows (glass-card), tiap baris: ikon file + nama + status pill + size + actions (Chunks / Ingest / Delete).
  - Expand row menampilkan chunk preview (sub-glass).
- **Tab Ingesting**:
  - Split 2 kolom: kiri = daftar dokumen processing (pill list), kanan = log + chunks (timeline).

### 2.5 History (`/history`)
- Glass-floating panel dengan:
  - Title "Riwayat Pertanyaan" + counter.
  - Search input glass-input dengan ikon search.
  - List item: collapsible card (summary dengan title + waktu + status pill), expand menampilkan Q & A.
- Empty state: ilustrasi soft + CTA "Mulai chat sekarang".

### 2.6 Change Password (`/change-password`)
- Form vertikal (max-w 420px) dalam glass-card:
  - 3 field input glass (Password Lama / Baru / Konfirmasi) + eye toggle.
  - Mismatch state: input ring merah, pesan di bawah.
  - Tombol kanan: Batal (ghost) + Simpan (gradient).
- Toast success kanan bawah: glass-card hijau border, fade out 3s.

### 2.7 Sidebar (global)
- Glass-floating panel kiri.
- Brand "Lumina" + logo di atas.
- Nav item: icon + label (desktop), icon-only (tablet), drawer (mobile).
- Active state: white-65% background + soft inner glow.
- History collapsible di bawah nav (terbatas 5 item, "Lihat semua" link).
- Logout di paling bawah.

### 2.8 Bottom Nav (mobile)
- Glass-floating 64px di bawah, 3-4 item (Chat, Upload [admin only], Riwayat).
- Active state: pill biru muda.

---

## 3. Micro-interactions

- **Hover** pada glass-card: `transform: translateY(-2px)` + shadow upgrade.
- **Press** pada tombol: scale 0.97, 100ms.
- **Focus** pada input: glow cyan ring 2px + border accent.
- **Message baru**: fade-in + translateY 8px → 0, 250ms.
- **Loading dots**: 3 titik bouncing dengan delay 150ms.
- **Sidebar drawer** (mobile): slide-in 240ms ease-out.
- **Dropdown profile**: scale 0.95 → 1 + opacity, 150ms.
- **Toast**: slide-up + fade, auto-dismiss 3s.

---

## 4. Accessibility

- Kontras teks di atas glass: minimum 4.5:1.
  - `--ink-900` di atas `rgba(255,255,255,0.55)` ≈ 13:1 ✓
  - `--ink-700` di atas `rgba(255,255,255,0.42)` ≈ 9:1 ✓
  - `--ink-500` di atas `rgba(255,255,255,0.5)` ≈ 5.4:1 ✓ (cocok untuk placeholder)
- Focus ring jelas pada semua control interaktif.
- `prefers-reduced-motion` honored: disable translate/scale, keep opacity only.
- Touch target minimal 44px (mobile nav & bottom bar).

---

## 5. Catatan Migrasi (untuk eksekusi nanti)

Ketika mockup disetujui, eksekusi ke kode produksi akan:

1. **Token**: tambah section di `app/globals.css` dengan variable baru, biarkan class lama
   (`glass-panel`, `glass-inner`, `guest-glass-*`) tetap ada sementara sebagai fallback.
2. **Halaman**: refactor per-halaman dengan menukar `glass-panel` → `glass-floating`,
   `glass-inner` → `glass-card` / `glass-input` sesuai konteks. Palette diubah dari
   `#1a3a52` / `#1a6fa8` ke token baru.
3. **Background**: hapus `/images/Background.png` (diganti CSS gradient + orbs).
4. **Komponen**: `Sidebar`, `Header`, `BottomNav` dirombak ringan (struktur JSX tetap).
5. **AGENTS.md** (frontend scope) di-update bila ada aturan tambahan.

> Tidak akan dijalankan sampai user menyetujui mockup.