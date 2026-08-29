export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  guesses: string[];
};

export const PLAYER_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Nombre completo", required: true, guesses: ["player", "full_name", "nombre", "jugador"] },
  { key: "nationality", label: "Nacionalidad", guesses: ["nacionalidad", "nationality", "nation", "pais"] },
  { key: "position", label: "Posición (código)", guesses: ["position", "posicion", "pos"] },
  { key: "team", label: "Equipo", guesses: ["equipo", "team", "club"] },
  { key: "matches_played", label: "Partidos jugados", guesses: ["partidos_jugados", "matches_played", "pj", "partidos"] },
  { key: "starts", label: "Titular (veces)", guesses: ["titular", "starts", "titularidades"] },
  { key: "minutes_played", label: "Minutos jugados", required: true, guesses: ["minutes_played", "minutos", "minutos_jugados", "min"] },
  { key: "nineties", label: "90s jugados", guesses: ["noventas_jugados", "nineties", "90s"] },
  { key: "goals", label: "Goles", guesses: ["goles", "goals", "gol"] },
  { key: "assists", label: "Asistencias", guesses: ["asistencias", "assists", "ast"] },
  { key: "yellow_cards", label: "Tarjetas amarillas", guesses: ["amarillas", "yellow_cards", "ta"] },
  { key: "red_cards", label: "Tarjetas rojas", guesses: ["rojas", "red_cards", "tr"] },
  { key: "edad", label: "Edad", guesses: ["edad", "age"] },
];

export const MARKET_VALUE_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Nombre completo", required: true, guesses: ["player", "full_name", "nombre", "jugador"] },
  { key: "nationality", label: "Nacionalidad (opcional, ayuda a desambiguar)", guesses: ["nacionalidad", "nationality"] },
  { key: "value_date", label: "Fecha (AAAA-MM-DD)", required: true, guesses: ["value_date", "fecha", "date"] },
  { key: "value_amount", label: "Valor de mercado", required: true, guesses: ["value_amount", "valor", "value", "market_value"] },
  { key: "currency", label: "Moneda (ej. EUR)", guesses: ["currency", "moneda"] },
  { key: "source", label: "Fuente", guesses: ["source", "fuente"] },
];

export function guessMapping(headers: string[], fields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  for (const field of fields) {
    const match = headers.find(
      (h) => !usedHeaders.has(h) && field.guesses.some((g) => h.trim().toLowerCase() === g.toLowerCase())
    );
    if (match) {
      mapping[field.key] = match;
      usedHeaders.add(match);
    }
  }
  return mapping;
}
