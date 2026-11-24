# Nuswap

**Tukar Kunci Nusuk untuk Sesama.** Aplikasi web untuk peserta Challenge Umrah Nusuk (1 Nov sampai 20 Des 2026) saling bertukar kode undangan `NG-xxxxxxxx`. Pemakai kode dan pemilik kode sama-sama mendapat kunci ekstra di aplikasi Nusuk. Tanpa daftar, tanpa login, dan Nuswap tidak pernah meminta password atau OTP akun Nusuk.

Dibangun dengan Next.js (App Router) + PostgreSQL, mengikuti PRD Final Tukar Kunci Nusuk.

## Fitur

- **Ambil Kunci**: perangkat baru langsung mendapat kode starter pemilik. Setelah itu kode komunitas dirotasi adil (paling sedikit dipakai tampil lebih dulu). Tombol "Salin + Buka di Nusuk" menyalin kode dan membuka deep link Nusuk. Pengguna melaporkan Berhasil/Gagal untuk kode yang pernah diambilnya; kode dipensiunkan otomatis bila dari 10 suara terakhir ada minimal 3 gagal dan gagal lebih banyak dari berhasil. Satu IP dihitung satu suara.
- **Grid Kunci Siap Pakai Lainnya**: 10 kartu bernomor berisi kode antrean, masing-masing dengan Copy code dan tombol Buka di Nusuk. Kode yang sudah diambil perangkat ini tampil "Sudah dipakai" dan nonaktif, karena satu kode hanya berlaku sekali per pasangan pengguna.
- **Riwayat Kunci Saya**: semua kunci yang pernah diambil perangkat ini tercatat dengan waktu pengambilan dan status Berhasil/Gagal, atau tombol lapor bila belum dilaporkan. Server menolak pengambilan ulang kunci yang sama (HTTP 409).
- **Titip Kunci**: tempel kode `NG-xxxxxxxx` atau tautan Nusuk utuh, sistem mengekstrak kodenya, menjaga huruf besar/kecil, menolak duplikat, dan menampilkan posisi antrean. Maksimal 5 kunci aktif per perangkat.
- **Cara Pakai**: 3 langkah memakai kode di aplikasi Nusuk plus catatan keamanan.
- **Tips dari Pemenang**: jawab 20 sampai 30 pertanyaan per pintu sampai tuntas, kerjakan menjelang atau sesudah sholat. Tips pengalaman, bukan jaminan menang.
- **Pemenang**: daftar pemenang harian terverifikasi dari pengumuman @MyNusuk dan menu Winners di aplikasi Nusuk.
- **Admin** (`/admin`): login, moderasi kode (retire dan aktifkan lagi), tambah pemenang harian, statistik asli dari database.

Perangkat pengunjung dikenali lewat cookie httpOnly `device_id` anonim. Tidak ada akun untuk pengunjung.

## Jalan lokal dengan Docker Compose

```bash
cp .env.example .env   # isi ADMIN_PASSWORD dan SESSION_SECRET
docker compose up --build
```

Aplikasi di http://localhost:3000, panel admin di http://localhost:3000/admin. Migrasi dan seed berjalan otomatis saat kontainer app start.

## Jalan lokal tanpa Docker

Butuh Node.js 20.12+ dan PostgreSQL 16 yang bisa dijangkau.

```bash
npm install
cp .env.example .env         # isi DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET
npm run db:migrate           # membuat tabel, seed kode starter + 12 pemenang, membuat akun admin
npm run build
npm run start                # atau: npm run dev untuk pengembangan
```

## Deploy ringkas (Vercel + Supabase/PostgreSQL)

1. Buat proyek PostgreSQL (mis. Supabase), ambil connection string-nya.
2. Import repo ini ke Vercel. Isi environment variable: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` (acak, minimal 32 karakter; tanpa ini login admin dimatikan), dan `NEXT_PUBLIC_SITE_URL`.
3. Jalankan migrasi sekali dari mesin lokal menunjuk ke database produksi: `DATABASE_URL=<connstring produksi> ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run db:migrate`.
4. Deploy. Pengunjung tidak butuh konfigurasi tambahan.

Saat memperbarui versi, **jalankan migrasi dulu, baru deploy**; migrasi aman diulang. Bila tidak memakai Vercel, taruh aplikasi di belakang reverse proxy yang mengisi `X-Forwarded-For` dan `X-Forwarded-Proto`, dan isi `TRUSTED_PROXY_HOPS` sesuai jumlah proxy. Tanpa proxy, IP bisa dikarang dan rate limit mudah dilewati.

## Update pemenang harian

Undian Challenge Umrah diumumkan sekitar pukul 20.00 WIB. Setiap hari sekitar **pukul 20.30 WIB**, admin:

1. Cek pengumuman resmi @MyNusuk atau menu Winners di aplikasi Nusuk.
2. Verifikasi ejaan nama pemenang secara manual.
3. Login ke `/admin`, isi formulir "Tambah Pemenang Harian", simpan.

Nama yang belum terverifikasi jangan dimasukkan.

## Struktur

- `app/`: halaman publik (5 tab), halaman `/admin`, dan route API.
- `lib/`: koneksi `pg`, urutan antrean, identitas perangkat, autentikasi admin, validasi kode, rate limit.
- `db/schema.sql`: skema 7 tabel + seed (kode starter dan 12 pemenang terverifikasi).
- `scripts/migrate.mjs`: menjalankan skema dan membuat akun admin dari env.
