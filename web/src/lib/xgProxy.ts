import type { PlayerSeasonStats } from "./types";
import { getStat } from "./metrics";

export type ShotQualityProxy = {
  goals: number;
  shotsOnTarget: number;
  leagueConversionRate: number;
  expectedGoals: number;
  diff: number;
};

// Proxy simplificado de "goles esperados": no usa ubicación del tiro (no
// tenemos esos datos), solo volumen de tiros al arco y la tasa de conversión
// promedio del pool de jugadores de la misma posición. Sirve para detectar
// sobre/bajo rendimiento respecto al volumen de tiro, no reemplaza un xG real.
export function computeShotQualityProxy(
  poolStats: PlayerSeasonStats[],
  target: PlayerSeasonStats | null | undefined
): ShotQualityProxy | null {
  const shotsOnTarget = getStat(target, "tiros_al_arco");
  const goals = getStat(target, "goles_sin_penal");
  if (shotsOnTarget === null || goals === null || shotsOnTarget <= 0) return null;

  let sumGoals = 0;
  let sumShots = 0;
  for (const s of poolStats) {
    const g = getStat(s, "goles_sin_penal");
    const sh = getStat(s, "tiros_al_arco");
    if (g !== null && sh !== null && sh > 0) {
      sumGoals += g;
      sumShots += sh;
    }
  }
  if (sumShots === 0) return null;

  const leagueConversionRate = sumGoals / sumShots;
  const expectedGoals = shotsOnTarget * leagueConversionRate;
  return { goals, shotsOnTarget, leagueConversionRate, expectedGoals, diff: goals - expectedGoals };
}
