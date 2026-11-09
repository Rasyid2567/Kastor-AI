# Redesign Guide: Kastor AI Web Dashboard

Panduan ini berlaku untuk semua modul (Dashboard, Data Siswa, Jadwal, Tugas & PR, Kas Kelas, Administrasi Kelas, AI & Utilitas, Developer Console) dan halaman login/registrasi. Arah visualnya mengikuti varian B: gelap, tenang, dengan satu aksen mint.

## Prinsip
1. Mobile-first: rancang layar kecil dulu, lalu tambahkan kolom di desktop.
2. Satu aksen saja (mint). Warna lain hanya untuk status.
3. Data padat tetap mudah dipindai: angka besar, label kecil, baris yang jelas.
4. Jangan pernah memakai data pribadi asli siswa di mockup atau contoh. Pakai data dummy.

## Token warna
- Background halaman: #0a0f1c (dengan gradien radial tipis #123c33 di bagian atas login)
- Panel / kartu: #111827
- Sidebar dan bottom nav: #0d1424
- Input dan item baris: #0b1322
- Garis pemisah: #1f2a3d
- Teks utama: #f1f5f9
- Teks sekunder: #94a3b8
- Placeholder: #55657e
- Aksen (tombol utama, menu aktif, fokus): #34d399, teks di atasnya #052e1f
- Latar aksen lembut: rgba(52,211,153,.12)
- Status peringatan: #fbbf24
- Status bahaya / hapus / menunggak: #f87171

## Tipografi
- Font utama: system-ui, -apple-system, "Segoe UI", sans-serif.
- Font mono (ui-monospace, Menlo): untuk NIS, nomor WhatsApp, kode, label kecil uppercase, jam jadwal, nama tabel database.
- Judul halaman 24px, weight 700, letter-spacing -0.02em.
- Judul panel 16px, weight 600.
- Angka statistik 28px, weight 700.
- Label kecil 11px uppercase, letter-spacing .06em, warna sekunder.
- Teks isi 14px. Teks bantuan 12px.
- Input minimal 16px agar tidak di-zoom di iOS.

## Layout
- Desktop (di atas 900px): sidebar 240px sticky, konten dengan padding 24px 28px.
- Mobile (900px ke bawah): sidebar disembunyikan. Gunakan bottom nav tetap dengan 5 item: Dashboard, Siswa, Jadwal, Kas, Lainnya. "Lainnya" membuka sheet berisi sisa menu, termasuk Tugas & PR, Administrasi, AI, dan Developer Console.
- Beri padding bawah sekitar 96px di konten mobile agar tidak tertutup bottom nav.
- Gunakan env(safe-area-inset-bottom) untuk bottom nav dan tombol melayang.
- Konteks kelas aktif tampil di atas sidebar (desktop) dan di header halaman (mobile).

## Komponen
- Tombol utama: tinggi 44px minimal, latar aksen, teks gelap, weight 700.
- Tombol sekunder: latar #0f1729, border #1f2a3d.
- Tombol berbahaya (Hapus): teks #f87171, border merah transparan, hanya di baris tabel atau menu sekunder, jangan di layar utama.
- Input: tinggi 50px, radius 12px, fokus dengan border aksen dan ring tipis.
- Kartu statistik: label kecil, angka besar, baris bawah berisi keterangan dan link aksi (warna aksen).
- Panel: header berisi judul, sub-judul, dan satu tombol aksi di kanan. Di mobile, tombol turun di bawah judul bila sempit.
- Baris item: kiri = jam atau nomor, tengah = judul dan keterangan, kanan = status. Tinggi minimal 56px.
- Tag status: pill kecil. Hijau untuk selesai atau aktif, kuning untuk menunggu, merah untuk mendesak atau menunggak.
- Chip peran (DEVELOPER): pill mono dengan border aksen transparan.
- Empty state: ikon kotak di lingkaran, judul singkat, satu kalimat penjelas, dan tombol aksi jika relevan.

## Tabel dan daftar
- Di desktop, tabel boleh dipakai untuk data banyak (Data Siswa, Rekap Kas, Statistik DB).
- Di mobile, setiap baris tabel berubah menjadi kartu: nama dan NIS di atas, nomor WhatsApp dan status di bawah, aksi di kanan atau di bawah sebagai tombol.
- Header tabel tidak boleh terpotong. Jika tetap dipakai sebagai tabel di mobile, bungkus dengan overflow-x: auto.
- Kolom aksi (Detail, Ubah, Hapus) diberi lebar tetap dan tidak ikut terpotong.

## Aturan per modul
- Dashboard: empat kartu ringkas. Di mobile jadi satu kolom. Jadwal hari ini dan tugas terdekat tampil sebagai daftar baris. Hari libur tampilkan empty state dengan arahan ke Jadwal Pelajaran.
- Data Siswa: search bar sticky di atas daftar. Tombol Tambah Siswa jadi tombol mengambang di mobile. Impor Massal ada di menu sekunder.
- Jadwal Pelajaran: di desktop pakai tabel blok. Di mobile pakai kartu per hari (pilih hari lewat chip horizontal yang bisa digeser). Filter minggu tetap di atas.
- Tugas & PR: tab Tugas Aktif dan Riwayat. Kartu tugas menampilkan tenggat dan persentase pengumpulan.
- Kas Kelas: kartu ringkasan tarif, minggu aktif, dan bendahara. Daftar siswa dengan status Lunas atau Menunggak. Di mobile, tombol Lunas dibuat besar agar mudah diketuk.
- Administrasi Kelas: daftar jabatan sebagai kartu atau baris dengan badge jabatan. Pratinjau pesan WhatsApp memakai font mono dengan latar lebih gelap. Di mobile, pratinjau dan form dipisah jadi dua tab.
- Struktur pengurus: jabatan (Ketua, Wakil, Sekretaris, Bendahara, dan seterusnya) tidak diketik manual. Pengurus dipilih dari daftar Data Siswa kelas aktif. Setiap baris jabatan menampilkan nama, NIS, dan nomor WhatsApp yang diambil langsung dari data siswa.

## Sumber data dan sinkronisasi
- Data Siswa adalah satu-satunya sumber nama, NIS, dan nomor WhatsApp di semua modul. Modul lain (Struktur Kelas, Kas, Tugas, Jadwal) hanya menyimpan referensi ke ID siswa, bukan salinan datanya.
- Untuk memilih pengurus, pakai komponen pencarian siswa: ketik nama atau NIS, lalu pilih dari hasil. Jangan izinkan pengetikan nama bebas untuk jabatan.
- Satu siswa hanya boleh memegang satu jabatan aktif. Jika siswa sudah menjabat di posisi lain, tampilkan peringatan dan minta konfirmasi sebelum memindahkan jabatannya.
- Jika data siswa diubah (nama atau nomor WhatsApp), tampilan jabatan ikut berubah otomatis tanpa perlu diedit ulang.
- Jika siswa dihapus, jabatan yang dipegangnya dikosongkan dan diberi tanda "perlu diisi ulang".
- Di mobile, pilihan siswa tampil sebagai bottom sheet dengan kolom pencarian di atas dan daftar di bawahnya.
- AI & Utilitas: layout chat memenuhi tinggi layar. Kotak input menempel di bawah. Kalkulator ilmiah tampil sebagai panel di bawah tab.
- Developer Console: hanya untuk peran DEVELOPER. Tabel boleh horizontal scroll di mobile. Metrik VPS tampil sebagai kartu dengan angka besar. Jangan tampilkan data sensitif (IP, path server, token) di tampilan yang bisa di-screenshot.

## Hak akses per peran
Setiap peran hanya melihat menu dan halaman yang diizinkan. Menu yang tidak boleh diakses disembunyikan dari sidebar dan menu HP. Kalau halaman dibuka lewat link, tampilkan halaman "Akses ditolak", bukan data.

| Peran | Halaman yang bisa dibuka | Catatan |
|---|---|---|
| Developer | Semua halaman, termasuk Developer Console | Bisa ganti kelas lewat dropdown Kelas |
| Ketua | Dashboard, Data Siswa, Jadwal, Kas Kelas, Buku Kas & Rekap, Tugas & PR, Administrasi Kelas | Kelas tetap di kelasnya, tidak bisa ganti |
| Wakil Ketua | Sama dengan Ketua | Sama dengan Ketua |
| Bendahara | Dashboard, Kas Kelas, Buku Kas & Rekap | Kelas tetap |
| Sekretaris | Dashboard, Data Siswa, Jadwal Pelajaran, Tugas & PR, Administrasi Kelas | Kelas tetap |

Aturan tambahan:
- Developer Console hanya untuk peran Developer.
- Dropdown Kelas di sidebar hanya aktif untuk Developer. Peran lain melihat nama kelasnya saja.
- Tombol aksi yang mengubah data (Tambah, Ubah, Hapus, Tandai lunas, Set libur) mengikuti hak akses halaman yang sama. Bendahara boleh menandai lunas di Kas Kelas, tetapi Sekretaris tidak melihat halaman Kas.
- Peran dicek di server, bukan hanya disembunyikan di tampilan.

## Login dan registrasi
- Kartu tengah dengan lebar maksimal 400px. Di mobile full-width dengan padding 16px.
- Tab Masuk dan Daftar berbentuk garis bawah. Judul dan sub-judul berganti sesuai tab.
- Registrasi punya indikator kekuatan sandi (4 bar, label Lemah / Cukup / Kuat / Sangat kuat) dan cek konfirmasi sandi. Tombol daftar aktif hanya jika sandi minimal 8 karakter dan cocok.

## Aksesibilitas
- Kontras teks minimal 4.5:1 untuk teks isi. Teks mono kecil jangan lebih redup dari #94a3b8.
- Area sentuh minimal 44x44px.
- Setiap ikon tanpa teks wajib punya aria-label.
- Hormati prefers-reduced-motion untuk transisi.
