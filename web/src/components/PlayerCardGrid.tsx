"use client";

import { useMemo, useState } from "react";
import type { PlayerListItem } from "@/lib/queries";
import type { PlayerRating } from "@/lib/rating";
import PlayerCard from "./PlayerCard";

type SortKey = "rating" | "goals" | "assists" | "minutes";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "goals", label: "Goles" },
  { key: "assists", label: "Asistencias" },
  { key: "minutes", label: "Minutos" },
];

export default function PlayerCardGrid({
  players,
  ratings,
  teamMatchTotals,
}: {
  players: PlayerListItem[];
  ratings: Record<string, PlayerRating | null>;
  teamMatchTotals: Record<string, number>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");

  const sorted = useMemo(() => {
    const copy = [...players];
    const valueFor = (p: PlayerListItem) => {
      const stats = p.season_stats[0];
      if (sortKey === "rating") return ratings[p.id]?.overall ?? -1;
      if (sortKey === "goals") return stats?.goals ?? -1;
      if (sortKey === "assists") return stats?.assists ?? -1;
      return stats?.minutes_played ?? -1;
    };
    copy.sort((a, b) => valueFor(b) - valueFor(a));
    return copy;
  }, [players, ratings, sortKey]);

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
        No se encontraron jugadores con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Ordenar:</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSortKey(s.key)}
            className={`rounded-full px-3 py-1.5 border transition-colors ${
              sortKey === s.key
                ? "bg-accent/15 text-accent-2 border-accent/40"
                : "border-border text-muted hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            rating={ratings[p.id] ?? null}
            teamMatches={p.team_id ? teamMatchTotals[p.team_id] : undefined}
          />
        ))}
      </div>
    </div>
  );
}
