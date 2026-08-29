"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerListItem } from "@/lib/queries";
import { getStat, POSITION_LABELS } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";

type Column = {
  key: string;
  label: string;
  get: (p: PlayerListItem) => number | null;
  format?: (v: number | null) => string;
};

const COLUMNS: Column[] = [
  { key: "minutes_played", label: "Min", get: (p) => p.season_stats[0]?.minutes_played ?? null },
  { key: "goals", label: "Gol", get: (p) => p.season_stats[0]?.goals ?? null },
  { key: "assists", label: "Ast", get: (p) => p.season_stats[0]?.assists ?? null },
  { key: "goles_p90", label: "Gol/90", get: (p) => getStat(p.season_stats[0], "goles_p90") },
  { key: "asistencias_p90", label: "Ast/90", get: (p) => getStat(p.season_stats[0], "asistencias_p90") },
  { key: "intercepciones_p90", label: "Int/90", get: (p) => getStat(p.season_stats[0], "intercepciones_p90") },
  { key: "entradas_p90", label: "Ent/90", get: (p) => getStat(p.season_stats[0], "entradas_p90") },
];

export default function PlayerTable({ players }: { players: PlayerListItem[] }) {
  const [sortKey, setSortKey] = useState("minutes_played");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const copy = [...players];
    copy.sort((a, b) => {
      const av = col ? col.get(a) : null;
      const bv = col ? col.get(b) : null;
      const an = av ?? -Infinity;
      const bn = bv ?? -Infinity;
      return sortDir === "desc" ? bn - an : an - bn;
    });
    return copy;
  }, [players, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
        No se encontraron jugadores con esos filtros.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-muted">
              <th className="px-4 py-3 font-medium sticky left-0 bg-surface-2">Jugador</th>
              <th className="px-3 py-3 font-medium">Pos</th>
              <th className="px-3 py-3 font-medium">Equipo</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="px-3 py-3 font-medium cursor-pointer select-none hover:text-foreground whitespace-nowrap"
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1 text-accent-2">{sortDir === "desc" ? "↓" : "↑"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60 transition-colors">
                <td className="px-4 py-2.5 sticky left-0 bg-surface">
                  <Link href={`/jugadores/${p.id}`} className="font-medium hover:text-accent-2 transition-colors">
                    {p.full_name}
                  </Link>
                  <div className="text-xs text-muted">{p.nationality || "—"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs rounded-full bg-surface-2 px-2 py-0.5 border border-border">
                    {p.position_group ? POSITION_LABELS[p.position_group] : "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted">{p.teams?.name ?? "—"}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-2.5 tabular-nums">
                    {formatNumber(c.get(p) ?? undefined, c.key.includes("_p90") ? 2 : 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
