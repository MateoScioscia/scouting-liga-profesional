import type { PlayerSeasonStats, PositionGroup } from "./types";
import { RADAR_METRICS, getStat, LOWER_IS_BETTER } from "./metrics";
import { percentile } from "./format";

export function computeRadarValues(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined,
  positionGroup: PositionGroup
): { metric: string; value: number }[] {
  const metrics = RADAR_METRICS[positionGroup];
  return metrics.map((m) => {
    const targetValue = getStat(target, m.key);
    if (targetValue === null) return { metric: m.short, value: 0 };
    const pool = poolStats.map((s) => getStat(s, m.key)).filter((v): v is number => v !== null).sort((a, b) => a - b);
    let pct = percentile(pool, targetValue);
    if (LOWER_IS_BETTER.has(m.key)) pct = 100 - pct;
    return { metric: m.short, value: pct };
  });
}
