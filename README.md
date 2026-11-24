# Nuswap

**Tukar Kunci Nusuk untuk Sesama.** Aplikasi web untuk peserta Challenge Umrah Nusuk (1 Nov sampai 20 Des 2026) saling bertukar kode undangan `NG-xxxxxxxx`. Pemakai kode dan pemilik kode sama-sama mendapat kunci ekstra di aplikasi Nusuk. Tanpa daftar, tanpa login, dan Nuswap tidak pernah meminta password atau OTP akun Nusuk.

Dibangun dengan Next.js (App Router) + PostgreSQL, mengikuti PRD Final Tukar Kunci Nusuk.

## Fitur

- **Ambil Kunci**: perangkat baru langsung mendapat kode starter pemilik. Setelah itu kode komunitas dirotasi adil (paling sedikit dipakai tampil lebih dulu). Tombol "Salin + Buka di Nusuk" menyalin kode dan membuka deep link Nusuk. Pengguna melaporkan Berhasil/Gagal; kode yang gagal 3 kali otomatis dipensiunkan.
- **Grid Kunci Siap Pakai Lainnya**: kartu bernomor berisi kode antrean, masing-masing dengan Copy code dan tombol Buka di Nusuk. Kode yang sudah diambil perangkat ini tampil "Sudah dipakai" dan nonaktif, karena satu kode hanya berlaku sekali per pasangan pengguna.
- **Titip Kunci**: tempel kode `NG-xxxxxxxx` atau tautan Nusuk utuh, sistem mengekstrak kodenya, menjaga huruf besar/kecil, menolak duplikat, dan menampilkan posisi antrean.
- **Cara Pakai**: 3 langkah memakai kode di aplikasi Nusuk plus catatan keamanan.
- **Tips dari Pemenang**: jawab 20 sampai 30 pertanyaan per pintu sampai tuntas, kerjakan menjelang atau sesudah sholat. Tips pengalaman, bukan jaminan menang.
- **Pemenang**: daftar pemenang harian terverifikasi dari pengumuman @MyNusuk dan menu Winners di aplikasi Nusuk.
- **Admin** (`/admin`): login, moderasi kode (retire), tambah pemenang harian, statistik asli dari database.

Perangkat pengunjung dikenali lewat cookie httpOnly `device_id` anonim. Tidak ada akun untuk pengunjung.

## Jalan lokal dengan Docker Compose

```bash
cp .env.example .env.local   # sesuaikan ADMIN_PASSWORD
docker compose up --build
```

Aplikasi di http://localhost:3000, panel admin di http://localhost:3000/admin. Migrasi dan seed berjalan otomatis saat kontainer app start.

## Jalan lokal tanpa Docker

Butuh Node.js 20+ dan PostgreSQL 16 yang bisa dijangkau.

```bash
npm install
cp .env.example .env.local   # isi DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
npm run db:migrate           # membuat tabel, seed kode starter + 12 pemenang, membuat akun admin
npm run build
npm run start                # atau: npm run dev untuk pengembangan
```

## Deploy ringkas (Vercel + Supabase/PostgreSQL)

1. Buat proyek PostgreSQL (mis. Supabase), ambil connection string-nya.
2. Import repo ini ke Vercel. Isi environment variable: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `SESSION_SECRET` (acak, panjang).
3. Jalankan migrasi sekali dari mesin lokal menunjuk ke database produksi: `DATABASE_URL=<connstring produksi> ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run db:migrate`.
4. Deploy. Pengunjung tidak butuh konfigurasi tambahan.

## Update pemenang harian

Undian Challenge Umrah diumumkan sekitar pukul 20.00 WIB. Setiap hari sekitar **pukul 20.30 WIB**, admin:

1. Cek pengumuman resmi @MyNusuk atau menu Winners di aplikasi Nusuk.
2. Verifikasi ejaan nama pemenang secara manual.
3. Login ke `/admin`, isi formulir "Tambah Pemenang Harian", simpan.

Nama yang belum terverifikasi jangan dimasukkan.

## Struktur

- `app/`: halaman publik (5 tab), halaman `/admin`, dan route API.
- `lib/`: koneksi `pg`, identitas perangkat, autentikasi admin, validasi kode, rate limit.
- `db/schema.sql`: skema 6 tabel + seed (kode starter dan 12 pemenang terverifikasi).
- `scripts/migrate.mjs`: menjalankan skema dan membuat akun admin dari env.
