import type { PlayerSeasonStats, PositionGroup } from "./types";
import { RADAR_METRICS, getStat, LOWER_IS_BETTER, type MetricDef } from "./metrics";
import { percentile } from "./format";

export type PeerSpread = { metric: string; values: number[] };

// Para cada métrica del radar, el percentil de TODOS los jugadores del pool
// (no solo el jugador destacado) — sirve para dibujar la nube de puntos de
// pares alrededor de cada eje del radar.
export function computePoolPercentileSpread(
  poolStats: PlayerSeasonStats[],
  positionGroup: PositionGroup
): PeerSpread[] {
  const metrics = RADAR_METRICS[positionGroup];
  return metrics.map((m) => {
    const raws = poolStats
      .map((s) => getStat(s, m.key))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const values = raws.map((v) => {
      let pct = percentile(raws, v);
      if (LOWER_IS_BETTER.has(m.key)) pct = 100 - pct;
      return pct;
    });
    return { metric: m.short, values };
  });
}

function metricPercentile(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined,
  m: MetricDef
): { raw: number | null; pct: number } {
  const targetValue = getStat(target, m.key);
  if (targetValue === null) return { raw: null, pct: 0 };
  const pool = poolStats.map((s) => getStat(s, m.key)).filter((v): v is number => v !== null).sort((a, b) => a - b);
  let pct = percentile(pool, targetValue);
  if (LOWER_IS_BETTER.has(m.key)) pct = 100 - pct;
  return { raw: targetValue, pct };
}

export function computeRadarValues(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined,
  positionGroup: PositionGroup
): { metric: string; value: number }[] {
  const metrics = RADAR_METRICS[positionGroup];
  return metrics.map((m) => {
    const { pct } = metricPercentile(poolStats, target, m);
    return { metric: m.short, value: pct };
  });
}

export type PercentileBar = { metric: MetricDef; raw: number | null; pct: number };

export function computeMetricPercentiles(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined,
  metrics: MetricDef[]
): PercentileBar[] {
  return metrics.map((m) => {
    const { raw, pct } = metricPercentile(poolStats, target, m);
    return { metric: m, raw, pct };
  });
}
