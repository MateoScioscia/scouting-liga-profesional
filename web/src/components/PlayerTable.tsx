"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerListItem } from "@/lib/queries";
import type { PlayerRating } from "@/lib/rating";
import { TIER_COLORS } from "@/lib/rating";
import { PERCENTILE_GROUPS, POSITION_LABELS, POSITION_COLORS, formatMetric, getStat, type MetricDef } from "@/lib/metrics";
import { computeSampleWarning } from "@/lib/sampleSize";
import { formatNumber } from "@/lib/format";
import Avatar from "./Avatar";
import TeamLogo from "./TeamLogo";
import SampleWarningBadge from "./SampleWarningBadge";

// Une las categorías del reporte de percentiles de las 4 posiciones en una
// sola lista de pestañas, deduplicando métricas repetidas (ej. "Disciplina"
// existe para FWD/MID/DEF con la misma métrica).
function buildCategoryTabs(): { category: string; metrics: MetricDef[] }[] {
  const map = new Map<string, MetricDef[]>();
  for (const groups of Object.values(PERCENTILE_GROUPS)) {
    for (const g of groups) {
      const existing = map.get(g.category) ?? [];
      for (const m of g.metrics) {
        if (!existing.some((e) => e.key === m.key)) existing.push(m);
      }
      map.set(g.category, existing);
    }
  }
  return Array.from(map.entries()).map(([category, metrics]) => ({ category, metrics }));
}

const CATEGORY_TABS = buildCategoryTabs();

// Paradas por partido (PPP): atajadas / partidos jugados.
function savesPerMatch(p: PlayerListItem): number | null {
  const s = p.season_stats[0];
  const saves = getStat(s, "atajadas");
  const matches = s?.matches_played ?? 0;
  return saves === null || matches === 0 ? null : saves / matches;
}

// Columnas de resumen según la posición filtrada: los arqueros se miran por
// arco en 0, goles en contra y paradas por partido en lugar de goles y asistencias.
const FIELD_COLUMNS = [
  { key: "goals", label: "Goles", title: "Goles", render: (p: PlayerListItem) => String(p.season_stats[0]?.goals ?? 0) },
  { key: "assists", label: "Asist.", title: "Asistencias", render: (p: PlayerListItem) => String(p.season_stats[0]?.assists ?? 0) },
];
const GK_COLUMNS = [
  { key: "vallas_invictas", label: "Arc en 0", title: "Arco en 0", render: (p: PlayerListItem) => formatMetric(getStat(p.season_stats[0], "vallas_invictas"), "int") },
  { key: "goles_recibidos", label: "GC", title: "Goles en contra", render: (p: PlayerListItem) => formatMetric(getStat(p.season_stats[0], "goles_recibidos"), "int") },
  { key: "ppp", label: "PPP", title: "Paradas por partido", render: (p: PlayerListItem) => formatNumber(savesPerMatch(p) ?? undefined, 1) },
];

function sortValue(p: PlayerListItem, ratings: Record<string, PlayerRating | null>, key: string): number | string | null {
  if (key === "name") return p.full_name;
  if (key === "rating") return ratings[p.id]?.overall ?? null;
  if (key === "ppp") return savesPerMatch(p);
  return getStat(p.season_stats[0], key);
}

function compareValues(a: number | string | null, b: number | string | null, dir: "asc" | "desc"): number {
  if (typeof a === "string" || typeof b === "string") {
    const as = String(a ?? "");
    const bs = String(b ?? "");
    return dir === "desc" ? bs.localeCompare(as) : as.localeCompare(bs);
  }
  const an = a ?? -Infinity;
  const bn = b ?? -Infinity;
  return dir === "desc" ? bn - an : an - bn;
}

function Th({
  label,
  title,
  sortKeyFor,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  title?: string;
  sortKeyFor: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const active = sortKeyFor === sortKey;
  return (
    <th
      onClick={() => onSort(sortKeyFor)}
      title={title}
      className="px-3 py-3 font-medium cursor-pointer select-none hover:text-foreground whitespace-nowrap"
    >
      {label}
      {active && <span className="ml-1 text-accent-2">{sortDir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

export default function PlayerTable({
  players,
  ratings,
  teamMatchTotals,
  goalkeepers = false,
  season,
}: {
  players: PlayerListItem[];
  ratings: Record<string, PlayerRating | null>;
  teamMatchTotals: Record<string, number>;
  goalkeepers?: boolean;
  season?: string;
}) {
  const summaryColumns = goalkeepers ? GK_COLUMNS : FIELD_COLUMNS;
  const seasonQuery = season ? `?temporada=${season}` : "";
  const [tab, setTab] = useState<string>("General");
  const [sortKey, setSortKey] = useState("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeCategory = CATEGORY_TABS.find((t) => t.category === tab);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...players];
    copy.sort((a, b) => compareValues(sortValue(a, ratings, sortKey), sortValue(b, ratings, sortKey), sortDir));
    return copy;
  }, [players, ratings, sortKey, sortDir]);

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
        No se encontraron jugadores con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {["General", ...CATEGORY_TABS.map((t) => t.category)].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 border transition-colors ${
              tab === t
                ? "bg-accent/15 text-accent-2 border-accent/40"
                : "border-border text-muted hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {t}
          </button>
        ))}
        {goalkeepers && (
          <span className="self-center ml-auto text-muted">Arc en 0 = arco en 0 · GC = goles en contra · PPP = paradas por partido</span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-muted">
                <th className="px-4 py-3 font-medium sticky left-0 bg-surface-2 z-10">Jugador</th>
                <th className="px-3 py-3 font-medium">Pos</th>
                <Th label="Edad" sortKeyFor="edad" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th
                  label="Minutos"
                  sortKeyFor="minutes_played"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                {summaryColumns.map((c) => (
                  <Th key={c.key} label={c.label} title={c.title} sortKeyFor={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                ))}
                {activeCategory?.metrics.map((m) => (
                  <Th key={m.key} label={m.short} sortKeyFor={m.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                ))}
                <Th label="Rendimiento" sortKeyFor="rating" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const stats = p.season_stats[0];
                const posColor = p.position_group ? POSITION_COLORS[p.position_group] : "var(--muted)";
                const rating = ratings[p.id];
                const tierColor = rating ? TIER_COLORS[rating.tier] : "var(--muted)";
                const sampleWarning = computeSampleWarning(stats?.matches_played, p.team_id ? teamMatchTotals[p.team_id] : undefined);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-surface">
                      <Link href={`/jugadores/${p.id}${seasonQuery}`} className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={p.photo_url} name={p.full_name} color={posColor} size={32} />
                        <div className="min-w-0">
                          <div className="font-medium truncate hover:text-accent-2 transition-colors">{p.full_name}</div>
                          <div className="text-xs text-muted truncate flex items-center gap-1">
                            <TeamLogo src={p.teams?.logo_url} name={p.teams?.name ?? ""} size={12} />
                            {p.teams?.name ?? "—"}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10px] font-medium rounded px-1.5 py-0.5"
                        style={{ color: posColor, background: `${posColor}22` }}
                      >
                        {p.position_group ? POSITION_LABELS[p.position_group] : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatNumber(getStat(stats, "edad") ?? undefined, 0)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatNumber(stats?.minutes_played ?? undefined, 0)}</td>
                    {summaryColumns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 tabular-nums">
                        {c.render(p)}
                      </td>
                    ))}
                    {activeCategory?.metrics.map((m) => (
                      <td key={m.key} className="px-3 py-2.5 tabular-nums">
                        {formatMetric(getStat(stats, m.key), m.format)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      {rating ? (
                        <span className="font-semibold tabular-nums" style={{ color: tierColor }}>
                          {Math.round(rating.overall)}
                        </span>
                      ) : (
                        "—"
                      )}
                      {sampleWarning && (
                        <span className="ml-1.5 inline-block align-middle">
                          <SampleWarningBadge warning={sampleWarning} compact />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/comparar?ids=${p.id}`} className="text-xs text-accent-2 hover:underline whitespace-nowrap">
                        Comparar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
