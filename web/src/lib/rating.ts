import type { PlayerSeasonStats, PositionGroup } from "./types";
import { PERCENTILE_GROUPS } from "./metrics";
import { computeMetricPercentiles } from "./percentiles";

export type RatingTier = "Elite" | "Destacado" | "Sólido" | "Promedio" | "Bajo";

export type CategoryRating = { category: string; score: number };

export type PlayerRating = {
  overall: number;
  tier: RatingTier;
  categories: CategoryRating[];
};

export function tierFor(overall: number): RatingTier {
  if (overall >= 85) return "Elite";
  if (overall >= 70) return "Destacado";
  if (overall >= 55) return "Sólido";
  if (overall >= 40) return "Promedio";
  return "Bajo";
}

export const TIER_COLORS: Record<RatingTier, string> = {
  Elite: "#4ade80",
  Destacado: "#38bdf8",
  Sólido: "#facc15",
  Promedio: "#93a8a0",
  Bajo: "#f87171",
};

// Rating compuesto 0-100: promedio de los percentiles de cada categoría del
// reporte de percentiles (ya agrupadas por posición), y esas mismas
// categorías reutilizadas como el desglose "por índice" de la tarjeta.
export function computePlayerRating(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined,
  positionGroup: PositionGroup
): PlayerRating | null {
  if (!target) return null;
  const groups = PERCENTILE_GROUPS[positionGroup];
  const categories: CategoryRating[] = groups.map((g) => {
    const bars = computeMetricPercentiles(poolStats, target, g.metrics).filter((b) => b.raw !== null);
    const score = bars.length > 0 ? bars.reduce((acc, b) => acc + b.pct, 0) / bars.length : 0;
    return { category: g.category, score };
  });
  const overall =
    categories.length > 0 ? categories.reduce((acc, c) => acc + c.score, 0) / categories.length : 0;
  return { overall, tier: tierFor(overall), categories };
}
