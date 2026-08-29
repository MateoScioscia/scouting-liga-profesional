import Link from "next/link";

const LINKS = [
  { href: "/jugadores", label: "Jugadores" },
  { href: "/comparar", label: "Comparar" },
  { href: "/cargar-datos", label: "Cargar datos" },
];

export default function Navbar() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/jugadores" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">⚽</span>
          <span className="font-semibold tracking-tight text-lg">
            Scouting <span className="text-accent-2">LPF</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
