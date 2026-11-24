import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
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
    images: [
      {
        url: "/og-image.png",
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
    images: ["/og-image.png"],
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
