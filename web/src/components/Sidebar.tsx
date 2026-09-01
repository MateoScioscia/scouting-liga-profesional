"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { heading: string; links: { href: string; label: string; hint: string; icon: string }[] }[] = [
  {
    heading: "Principal",
    links: [
      { href: "/jugadores", label: "Jugadores", hint: "Base de datos y scouting", icon: "⚽" },
      { href: "/comparar", label: "Comparar", hint: "Comparativa lado a lado", icon: "⇄" },
    ],
  },
  {
    heading: "Datos",
    links: [{ href: "/cargar-datos", label: "Cargar datos", hint: "Importar CSV / Excel", icon: "⇧" }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface/60 h-screen sticky top-0 overflow-y-auto scrollbar-thin">
      <Link href="/jugadores" className="flex items-center gap-2 px-5 py-6">
        <span className="text-2xl">⚽</span>
        <span className="font-semibold tracking-tight text-lg leading-tight">
          Scouting <span className="text-accent-2">LPF</span>
        </span>
      </Link>
      <nav className="flex-1 px-3 pb-6 flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {section.heading}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.links.map((l) => {
                const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm border transition-colors ${
                      active
                        ? "bg-accent/15 text-accent-2 border-accent/30"
                        : "text-muted hover:text-foreground hover:bg-surface-2 border-transparent"
                    }`}
                  >
                    <span className="text-base leading-none">{l.icon}</span>
                    <span>
                      <span className="block font-medium leading-tight">{l.label}</span>
                      <span className="block text-[11px] text-muted leading-tight">{l.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
