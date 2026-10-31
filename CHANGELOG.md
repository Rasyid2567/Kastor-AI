# Changelog

Semua perubahan penting pada proyek **Kastor AI (ARAS)** didokumentasikan di berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/)
dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-31

### Ditambahkan
- **Dual-Engine Architecture**: Integrasi bot WhatsApp Baileys v7 dan Web Dashboard dalam arsitektur konkurensi SQLite mode WAL (*Write-Ahead Logging*).
- **Jadwal Pelajaran Sistem Blok SMK**: Perhitungan otomatis minggu KBM ganjil/genap (Blok Teori vs Blok Bengkel/Praktik) beserta notifikasi perlengkapan wearpack & safety shoes.
- **Buku Kas & Akuntansi Transparan**: Modul kas kelas dengan input privat pesan pribadi (teks centang & impor file `.xlsx`) dan laporan transparan di grup tanpa angka total tunggakan.
- **Automasi Pengingat Tugas & PR**: Penjadwalan Cron otomatis setiap pukul 19.00 WIB untuk tugas sekolah dengan tenggat waktu $\le 24$ jam.
- **Multi-Group Class Linking**: Perintah `/link`, `/link list`, dan `/unlink` untuk menghubungkan grup WhatsApp cabang (putra/putri/diskusi) ke satu kelas induk.
- **Modul Rahasia Data Orang Tua**: Perintah tersembunyi `/ortu [no/nama]` untuk melihat informasi kontak wali murid tanpa terekspos di menu publik.
- **Alat Bantu Media Cerdas**: Pembuatan stiker WebP otomatis dengan *Sticker Rate Limiter*, konversi stiker ke gambar (`/toimg`), Optical Character Recognition (`/ocr`), penggabung PDF (`/topdf`), dan kalkulator matematika instan (`/calc`).
- **Asisten Pembelajaran AI**: Integrasi API Google Gemini dan Ollama lokal untuk menjawab pertanyaan materi pelajaran secara kontekstual.
- **Responsive Web Dashboard**: Antarmuka Midnight Slate Dark Theme (WCAG AAA) berbasis Vanilla ES6 Modules tanpa kompilasi/bundler eksternal.
- **Role-Based Access Control (RBAC)**: Otorisasi 5 tingkat (`DEVELOPER`, `KETUA`, `WAKIL`, `SEKRETARIS`, `BENDAHARA`) dengan enkripsi password Scrypt dan proteksi sesi cookie `HttpOnly; SameSite=Lax`.
- **Suite Pengujian Mandiri**: Pengujian komprehensif logika bot, 145 skenario API/RBAC/SQLi/XSS, serta 20 skenario responsivitas E2E tanpa mengekspos data pribadi siswa.
