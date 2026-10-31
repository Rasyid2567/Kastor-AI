# Panduan Berkontribusi pada Kastor AI (ARAS 1.0)

Terima kasih atas ketertarikan Anda untuk berkontribusi pada pengembangan **Kastor AI**! Proyek ini terbuka untuk siapa saja yang ingin membantu meningkatkan sistem administrasi kelas, manajemen jadwal blok SMK, serta automasi WhatsApp & web dashboard.

---

## 🛠️ Prasyarat Pengembangan

Anda dapat menjalankan proyek ini menggunakan salah satu runtime JavaScript/TypeScript modern berikut:
- **Deno** $\ge$ v2.0 (Disarankan untuk testing & runtime cepat)
- **Bun** $\ge$ v1.1
- **Node.js** $\ge$ v20.0

Alat tambahan opsional:
- **Git**
- Akun WhatsApp untuk pengujian koneksi bot (dapat menggunakan nomor sekunder / bot)

---

## 🚀 Memulai Lingkungan Lokal

1. **Fork & Clone Repositori**
   ```bash
   git clone https://github.com/<username>/Kastor-AI.git
   cd Kastor-AI
   ```

2. **Pasang Dependensi & Penyiapan Awal**
   Jalankan script penyiapan otomatis sesuai runtime pilihan Anda:
   ```bash
   # Menggunakan Node.js:
   npm install
   npm run setup

   # Atau menggunakan Deno:
   deno task setup

   # Atau menggunakan Bun:
   bun install && bun run setup
   ```
   Perintah ini akan menyalin `.env.example` ke `.env` dan mengisi database contoh awal.

3. **Menjalankan Pengujian Lokal**
   Pastikan seluruh test suite lulus sebelum dan sesudah membuat perubahan:
   ```bash
   # Menggunakan Node.js (NPM):
   npm test
   npm run test:web
   npm run test:e2e

   # Atau menggunakan Deno:
   deno task test
   deno task test:web
   deno task test:e2e
   ```

4. **Menjalankan Bot dan Web Dashboard**
   - **WhatsApp Bot**:
     ```bash
     npm start
     # atau: deno task start / bun start
     ```
   - **Web Dashboard**:
     ```bash
     npm run web
     # atau: deno task web / bun run web
     ```
     Buka browser pada `http://localhost:3001`.

---

## 📋 Alur Kontribusi (Pull Request)

1. Buat branch baru dari cabang `main`:
   ```bash
   git checkout -b fitur/nama-fitur-anda
   ```
2. Buat perubahan kode Anda. Pastikan:
   - Tidak ada data pribadi (nama/nomor HP riil) yang di-hardcode ke dalam kode sumber.
   - Tetap mematuhi struktur kode modular di `bot/modules/` dan `web/src/`.
   - Kode lulus pengujian (`deno task test` & `deno task test:web`).
3. Tulis pesan commit yang jelas dan deskriptif:
   ```bash
   git commit -m "feat(jadwal): tambahkan filter pencarian berdasarkan ruang bengkel"
   ```
4. Push branch ke fork Anda dan buat **Pull Request (PR)** ke branch `main`.

---

## 🔒 Kebijakan Keamanan

Jika Anda menemukan celah keamanan yang berpotensi membahayakan data pengguna atau token sesi, **mohon untuk TIDAK membuat issue publik**. Harap ikuti panduan di [SECURITY.md](SECURITY.md).
