import type { PercentileBar } from "./percentiles";
import type { ShotQualityProxy } from "./xgProxy";

type PhraseSet = { strength?: string; weakness?: string };

// Frases por métrica: solo para las que ya calculamos como parte del
// reporte de percentiles (ver PERCENTILE_GROUPS en metrics.ts).
const PHRASES: Record<string, PhraseSet> = {
  goles_p90: { strength: "Convierte muchos goles por partido", weakness: "Le cuesta convertir goles" },
  goles_sin_penal: { strength: "Genera goles de jugada, sin depender de penales" },
  tiros_p90: { strength: "Genera mucho volumen de tiro", weakness: "Participa poco en la definición" },
  pct_tiros_al_arco: { strength: "Gran precisión de tiro", weakness: "Poca precisión de tiro" },
  goles_por_tiro: { strength: "Necesita pocos tiros para marcar", weakness: "Necesita muchos tiros para marcar" },
  asistencias_p90: { strength: "Genera muchas asistencias", weakness: "Aporta pocas asistencias" },
  centros_p90: { strength: "Centra mucho al área", weakness: "Centra poco al área" },
  faltas_recibidas: { strength: "Provoca muchas faltas rivales", weakness: "Provoca pocas faltas rivales" },
  faltas_p90: { strength: "Jugador disciplinado, comete pocas faltas", weakness: "Comete muchas faltas" },
  intercepciones_p90: { strength: "Intercepta mucho el juego rival", weakness: "Intercepta poco el juego rival" },
  entradas_p90: { strength: "Gana muchos duelos con entradas", weakness: "Gana pocos duelos con entradas" },
  pct_atajadas: { strength: "Gran porcentaje de atajadas", weakness: "Bajo porcentaje de atajadas" },
  goles_recibidos_p90: { strength: "Recibe pocos goles por partido", weakness: "Recibe muchos goles por partido" },
  pct_vallas_invictas: {
    strength: "Mantiene la valla invicta con frecuencia",
    weakness: "Le cuesta mantener la valla invicta",
  },
  penales_atajados: { strength: "Ataja penales con eficacia" },
};

const STRENGTH_THRESHOLD = 75;
const WEAKNESS_THRESHOLD = 25;
const MAX_ITEMS = 6;
const SHOT_QUALITY_THRESHOLD = 1.5;

export type PlayerInsights = { strengths: string[]; weaknesses: string[] };

// Genera texto de "puntos fuertes / áreas de mejora" a partir de los
// percentiles que ya calculamos — no depende de ningún dato nuevo.
export function computeInsights(bars: PercentileBar[], shotQuality: ShotQualityProxy | null): PlayerInsights {
  const strengthCandidates: { text: string; weight: number }[] = [];
  const weaknessCandidates: { text: string; weight: number }[] = [];

  for (const b of bars) {
    if (b.raw === null) continue;
    const phrases = PHRASES[b.metric.key];
    if (!phrases) continue;
    if (b.pct >= STRENGTH_THRESHOLD && phrases.strength) {
      strengthCandidates.push({ text: phrases.strength, weight: b.pct });
    } else if (b.pct <= WEAKNESS_THRESHOLD && phrases.weakness) {
      weaknessCandidates.push({ text: phrases.weakness, weight: 100 - b.pct });
    }
  }

  if (shotQuality) {
    if (shotQuality.diff >= SHOT_QUALITY_THRESHOLD) {
      strengthCandidates.push({
        text: "Convierte más goles de los esperados por su volumen de tiro (estimado)",
        weight: 100,
      });
    } else if (shotQuality.diff <= -SHOT_QUALITY_THRESHOLD) {
      weaknessCandidates.push({
        text: "Convierte menos goles de los esperados por su volumen de tiro (estimado)",
        weight: 100,
      });
    }
  }

  strengthCandidates.sort((a, b) => b.weight - a.weight);
  weaknessCandidates.sort((a, b) => b.weight - a.weight);

  return {
    strengths: strengthCandidates.slice(0, MAX_ITEMS).map((c) => c.text),
    weaknesses: weaknessCandidates.slice(0, MAX_ITEMS).map((c) => c.text),
  };
}
