import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Domain produksi resmi Nuswap. Dipakai sebagai nilai bawaan metadataBase
// (og:image, canonical) supaya thumbnail berbagi tetap benar walau
// NEXT_PUBLIC_SITE_URL lupa diisi di env hosting. Env tetap menang bila diisi
// (untuk lokal/staging), dan host Vercel menang atas bawaan ini.
const PRODUCTION_URL = "https://nuswap.rotalogic.id";
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelHost ? `https://${vercelHost}` : PRODUCTION_URL);
const title = "Nuswap: Tukar Kunci Nusuk untuk Sesama";
const description =
  "Tukar kode undangan Challenge Umrah Nusuk dengan peserta lain. Ambil kunci, titip kuncimu, sama-sama dapat kunci ekstra. Tanpa daftar, tanpa login.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Nuswap",
    title,
    description,
    url: "/",
    // Nama berkas berversi (v2): alamat gambar yang belum pernah dilihat
    // crawler Meta/LinkedIn, supaya pratinjau tidak memakai cache lama dari
    // masa og:image masih menunjuk localhost. Naikkan nomor versi bila
    // gambar diganti dan pratinjau platform lagi-lagi basi.
    images: [
      {
        url: "/og-image-v2.jpg",
        secureUrl: `${siteUrl}/og-image-v2.jpg`,
        type: "image/jpeg",
        width: 1200,
        height: 630,
        alt: "Nuswap: Tukar Kunci Nusuk untuk Sesama",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image-v2.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
