import type { PlayerSeasonStats, PositionGroup } from "./types";
import { PERCENTILE_GROUPS, getStat, type MetricDef } from "./metrics";
import { computeMetricPercentiles } from "./percentiles";

// Métrica principal para seguir la evolución, por posición.
export const KEY_METRIC: Record<PositionGroup, MetricDef> = {
  FWD: { key: "goles_asist_p90", label: "Goles + asist. cada 90'", short: "G+A/90", format: "dec" },
  MID: { key: "goles_asist_p90", label: "Goles + asist. cada 90'", short: "G+A/90", format: "dec" },
  DEF: { key: "entradas_p90", label: "Entradas cada 90'", short: "Ent/90", format: "dec" },
  GK: { key: "pct_atajadas", label: "% de paradas", short: "%Par", format: "pct" },
};

export function keyMetricValue(stats: PlayerSeasonStats | null | undefined, positionGroup: PositionGroup): number | null {
  if (!stats) return null;
  const m = KEY_METRIC[positionGroup];
  if (m.key === "goles_asist_p90") {
    const nineties = stats.nineties ?? (stats.minutes_played ? stats.minutes_played / 90 : 0);
    return nineties > 0 ? ((stats.goals ?? 0) + (stats.assists ?? 0)) / nineties : null;
  }
  return getStat(stats, m.key);
}

export type SeasonPercentiles = { metric: MetricDef; bySeason: Record<string, number | null>; change: number | null };

// Percentil de cada métrica del reporte en cada temporada, calculado contra
// los pares de ESA temporada (misma posición y liga). `pools` trae, por
// temporada, las filas de estadísticas de los pares.
export function computeSeasonPercentiles(
  seasons: PlayerSeasonStats[],
  pools: Record<string, PlayerSeasonStats[]>,
  positionGroup: PositionGroup
): SeasonPercentiles[] {
  const metrics = PERCENTILE_GROUPS[positionGroup].flatMap((g) => g.metrics);
  const ordered = [...seasons].sort((a, b) => a.season.localeCompare(b.season));
  return metrics.map((metric) => {
    const bySeason: Record<string, number | null> = {};
    for (const s of ordered) {
      const [bar] = computeMetricPercentiles(pools[s.season] ?? [], s, [metric]);
      bySeason[s.season] = bar.raw === null ? null : bar.pct;
    }
    const values = ordered.map((s) => bySeason[s.season]).filter((v): v is number => v !== null);
    return { metric, bySeason, change: values.length > 1 ? values[values.length - 1] - values[0] : null };
  });
}
