import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apoyo SaluPro — Sistema de Emergencias",
  description: "Sistema de atención y registro de catástrofes — Estado La Guaira",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-muted">{children}</body>
    </html>
  );
}
