"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { PositionGroup } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/metrics";

type Team = { id: string; name: string };

const POSITIONS: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];

export default function FilterBar({
  teams,
  nationalities,
}: {
  teams: Team[];
  nationalities: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q);
  }

  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar jugador por nombre…"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#06170e] hover:bg-accent-2 transition-colors"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-3">
        <select
          value={searchParams.get("position") ?? ""}
          onChange={(e) => updateParam("position", e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Todas las posiciones</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {POSITION_LABELS[p]}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("team") ?? ""}
          onChange={(e) => updateParam("team", e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[220px]"
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("nationality") ?? ""}
          onChange={(e) => updateParam("nationality", e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent max-w-[180px]"
        >
          <option value="">Toda nacionalidad</option>
          {nationalities.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("minMinutes") ?? ""}
          onChange={(e) => updateParam("minMinutes", e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Minutos jugados: cualquiera</option>
          <option value="90">90+ minutos</option>
          <option value="450">450+ minutos</option>
          <option value="900">900+ minutos</option>
          <option value="1350">1350+ minutos</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname));
            }}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Limpiar filtros
          </button>
        )}
        {isPending && <span className="self-center text-xs text-muted">Actualizando…</span>}
      </div>
    </div>
  );
}
