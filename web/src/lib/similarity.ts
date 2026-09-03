import type { PositionPoolPlayer } from "./queries";
import { RADAR_METRICS, getStat, LOWER_IS_BETTER } from "./metrics";
import { percentile } from "./format";
import type { PlayerSeasonStats, PositionGroup } from "./types";

export type SimilarPlayer = { id: string; name: string; team: string | null; similarity: number };

// Similitud entre jugadores de la misma posición: distancia euclídea sobre
// el vector de percentiles de las mismas métricas del radar, convertida a
// un score 0-100 más intuitivo. No requiere datos nuevos.
export function computeSimilarPlayers(
  pool: PositionPoolPlayer[],
  targetId: string,
  targetStats: PlayerSeasonStats | null,
  positionGroup: PositionGroup,
  limit = 4
): SimilarPlayer[] {
  if (!targetStats) return [];
  const metrics = RADAR_METRICS[positionGroup];

  const vectors = new Map<string, number[]>();
  for (const m of metrics) {
    const raws = pool
      .map((p) => ({ id: p.id, v: getStat(p.season_stats[0] ?? null, m.key) }))
      .filter((r): r is { id: string; v: number } => r.v !== null);
    const sorted = raws.map((r) => r.v).sort((a, b) => a - b);
    for (const r of raws) {
      let pct = percentile(sorted, r.v);
      if (LOWER_IS_BETTER.has(m.key)) pct = 100 - pct;
      const vec = vectors.get(r.id) ?? [];
      vec.push(pct);
      vectors.set(r.id, vec);
    }
  }

  const targetVec = vectors.get(targetId);
  if (!targetVec || targetVec.length === 0) return [];
  const maxDistance = Math.sqrt(targetVec.length) * 100;

  const results: SimilarPlayer[] = [];
  for (const p of pool) {
    if (p.id === targetId) continue;
    const vec = vectors.get(p.id);
    if (!vec || vec.length !== targetVec.length) continue;
    const distance = Math.sqrt(vec.reduce((acc, v, i) => acc + (v - targetVec[i]) ** 2, 0));
    const similarity = Math.round(100 * (1 - distance / maxDistance));
    results.push({ id: p.id, name: p.full_name, team: p.teams?.name ?? null, similarity });
  }
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}
