"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/jugadores", label: "Jugadores" },
  { href: "/comparar", label: "Comparar" },
  { href: "/cargar-datos", label: "Cargar datos" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="md:hidden border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/jugadores" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">⚽</span>
          <span className="font-semibold tracking-tight text-sm">
            Scouting <span className="text-accent-2">LPF</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
                  active ? "text-accent-2 bg-accent/10" : "text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
