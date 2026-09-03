const LOW_SAMPLE_RATIO = 0.3;

export type SampleWarning = { matchesPlayed: number; teamMatches: number };

// Aviso de muestra chica: no excluye al jugador de ningún cálculo, solo
// marca cuando jugó una fracción baja de los partidos que ya disputó su
// equipo esta temporada — en ese caso el rating/percentiles pueden estar
// distorsionados por pocos minutos.
export function computeSampleWarning(
  matchesPlayed: number | null | undefined,
  teamMatches: number | undefined
): SampleWarning | null {
  if (!matchesPlayed || !teamMatches || teamMatches <= 0) return null;
  if (matchesPlayed / teamMatches < LOW_SAMPLE_RATIO) {
    return { matchesPlayed, teamMatches };
  }
  return null;
}
