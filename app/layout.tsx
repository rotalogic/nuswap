import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuswap: Tukar Kunci Nusuk untuk Sesama",
  description:
    "Tukar kode undangan Challenge Umrah Nusuk dengan peserta lain. Ambil kunci, titip kuncimu, sama-sama dapat kunci ekstra. Tanpa daftar, tanpa login.",
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
