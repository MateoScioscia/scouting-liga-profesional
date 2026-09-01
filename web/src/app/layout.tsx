import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scouting LPF — Análisis de jugadores",
  description: "Plataforma de scouting: KPIs, filtros y comparación de jugadores de la Liga Profesional Argentina.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-full">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <MobileNav />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
