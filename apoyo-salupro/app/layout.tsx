import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const body = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Apoyo SaluPro — Búsqueda y reunificación de personas",
  description:
    "Plataforma pública de búsqueda, registro y reunificación de personas afectadas por catástrofes — Venezuela",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${display.variable} ${body.variable}`}
    >
      <body className="min-h-full flex flex-col bg-card">{children}</body>
    </html>
  );
}
