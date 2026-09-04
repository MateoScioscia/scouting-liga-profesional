import type { PlayerInsights } from "./insights";
import { POSITION_LABELS } from "./metrics";
import type { RatingTier } from "./rating";
import type { PositionGroup } from "./types";

const TIER_PHRASES: Record<RatingTier, string> = {
  Elite: "viene de una temporada de nivel elite",
  Destacado: "viene de una temporada destacada",
  Sólido: "viene de una temporada sólida",
  Promedio: "viene de una temporada promedio",
  Bajo: "viene de una temporada floja",
};

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function joinList(items: string[]): string {
  const lowered = items.map(lowerFirst);
  if (lowered.length === 1) return lowered[0];
  return `${lowered.slice(0, -1).join(", ")} y ${lowered[lowered.length - 1]}`;
}

// Arma un resumen en prosa a partir de datos reales que ya calculamos
// (rating, percentiles, insights) -- sin ningún servicio de IA de por
// medio, así que no tiene costo ni depende de ninguna API externa.
export function computeSummaryText(
  firstName: string,
  positionGroup: PositionGroup,
  tier: RatingTier,
  overall: number,
  insights: PlayerInsights,
  lowSample: boolean
): string {
  const posLabel = POSITION_LABELS[positionGroup].toLowerCase();
  const sentences: string[] = [
    `${firstName}, ${posLabel}, ${TIER_PHRASES[tier]} (percentil ${Math.round(overall)} entre ${posLabel}es de la liga).`,
  ];

  if (insights.strengths.length > 0) {
    sentences.push(`Se destaca por: ${joinList(insights.strengths.slice(0, 3))}.`);
  }

  if (insights.weaknesses.length > 0) {
    sentences.push(`Como punto a mejorar: ${joinList(insights.weaknesses.slice(0, 2))}.`);
  }

  if (lowSample) {
    sentences.push("Jugó pocos minutos esta temporada, así que estas conclusiones son preliminares.");
  }

  return sentences.join(" ");
}
