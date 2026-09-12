export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  guesses: string[];
  group?: string;
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
  { key: "photo_url", label: "URL de foto (opcional)", guesses: ["photo_url", "foto", "photo", "imagen"] },
  { key: "height_cm", label: "Estatura en cm (opcional)", guesses: ["height_cm", "estatura", "altura", "height"] },
  {
    key: "contract_until",
    label: "Fin de contrato AAAA-MM-DD (opcional)",
    guesses: ["contract_until", "contrato", "fin_contrato", "contract"],
  },
];

export const MARKET_VALUE_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Nombre completo", required: true, guesses: ["player", "full_name", "nombre", "jugador"] },
  { key: "nationality", label: "Nacionalidad (opcional, ayuda a desambiguar)", guesses: ["nacionalidad", "nationality"] },
  { key: "value_date", label: "Fecha (AAAA-MM-DD)", required: true, guesses: ["value_date", "fecha", "date"] },
  { key: "value_amount", label: "Valor de mercado", required: true, guesses: ["value_amount", "valor", "value", "market_value"] },
  { key: "currency", label: "Moneda (ej. EUR)", guesses: ["currency", "moneda"] },
  { key: "source", label: "Fuente", guesses: ["source", "fuente"] },
];

// Export tipo Wyscout, partido a partido, para jugadores de scouting
// externo (fuera del roster de la Liga Profesional). Los "guesses" son
// los encabezados exactos que trae ese tipo de export, asi que el mapeo
// automatico deberia funcionar sin tocar nada en la mayoria de los casos.
export const SCOUTING_MATCH_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Nombre completo", required: true, guesses: ["nombre completo", "player", "full_name"], group: "Datos del partido" },
  { key: "match_number", label: "Partido N°", guesses: ["partido n°", "partido n", "match"], group: "Datos del partido" },
  { key: "opponent", label: "Partido (rival)", required: true, guesses: ["partido", "opponent", "rival"], group: "Datos del partido" },
  { key: "result_code", label: "V, E o D", guesses: ["v, e o d", "resultado (v/e/d)"], group: "Datos del partido" },
  { key: "score", label: "Resultado", guesses: ["resultado", "score"], group: "Datos del partido" },
  { key: "competition", label: "Competencia", guesses: ["competition", "competicion", "competición"], group: "Datos del partido" },
  { key: "match_date", label: "Fecha", required: true, guesses: ["date", "fecha"], group: "Datos del partido" },
  { key: "position_specific", label: "Posición específica", guesses: ["posición específica", "posicion especifica"], group: "Datos del partido" },
  { key: "minutes_played", label: "Minutos jugados", required: true, guesses: ["minutos jugados"], group: "Datos del partido" },

  { key: "actions_total", label: "Acciones totales", guesses: ["acciones totales"], group: "Volumen" },
  { key: "actions_successful", label: "Acciones totales logradas", guesses: ["acciones totales logradas"], group: "Volumen" },
  { key: "goals", label: "Goles", guesses: ["goles"], group: "Ofensivo" },
  { key: "assists", label: "Asistencias", guesses: ["asistencias"], group: "Ofensivo" },
  { key: "shots", label: "Tiros", guesses: ["tiros"], group: "Ofensivo" },
  { key: "shots_on_target", label: "Tiros logrados", guesses: ["tiros logrados"], group: "Ofensivo" },
  { key: "xg", label: "xG", guesses: ["xg"], group: "Ofensivo" },
  { key: "shot_assists", label: "Asistencias a tiro", guesses: ["asistencias a tiro"], group: "Ofensivo" },
  { key: "crosses", label: "Centros", guesses: ["centros"], group: "Ofensivo" },
  { key: "crosses_accurate", label: "Centros precisos", guesses: ["centros precisos"], group: "Ofensivo" },
  { key: "dribbles", label: "Regates", guesses: ["regates"], group: "Ofensivo" },
  { key: "dribbles_successful", label: "Regates logrados", guesses: ["regates logrados"], group: "Ofensivo" },
  { key: "offensive_duels", label: "Duelos ofensivos", guesses: ["duelos ofensivos"], group: "Duelos" },
  { key: "offensive_duels_won", label: "Duelos ofensivos ganados", guesses: ["duelos ofensivos ganados"], group: "Duelos" },
  { key: "penalty_area_touches", label: "Toques en el área de penalti", guesses: ["toques en el área de penalti", "toques en el area de penalti"], group: "Ofensivo" },
  { key: "offsides", label: "Fuera de juego", guesses: ["fuera de juego"], group: "Ofensivo" },
  { key: "deep_runs", label: "Carreras en profundidad", guesses: ["carreras en profundidad"], group: "Ofensivo" },
  { key: "fouls_suffered", label: "Faltas recibidas", guesses: ["faltas recibidas"], group: "Ofensivo" },

  { key: "passes", label: "Pases", guesses: ["pases"], group: "Pases" },
  { key: "passes_accurate", label: "Pases logrados", guesses: ["pases logrados"], group: "Pases" },
  { key: "long_passes", label: "Pases largos", guesses: ["pases largos"], group: "Pases" },
  { key: "long_passes_accurate", label: "Pases largos logrados", guesses: ["pases largos logrados"], group: "Pases" },
  { key: "deep_passes", label: "Pases en profundidad", guesses: ["pases en profundidad"], group: "Pases" },
  { key: "deep_passes_accurate", label: "Pases en profundidad logrados", guesses: ["pases en profundidad logrados"], group: "Pases" },
  { key: "xa", label: "xA", guesses: ["xa"], group: "Pases" },
  { key: "passes_final_third", label: "Pases en el último tercio", guesses: ["pases en el último tercio", "pases en el ultimo tercio"], group: "Pases" },
  { key: "passes_final_third_accurate", label: "Pases en el último tercio logrados", guesses: ["pases en el último tercio logrados", "pases en el ultimo tercio logrados"], group: "Pases" },
  { key: "passes_penalty_area", label: "Pases hacia el área de penalti", guesses: ["pases hacia el área de penalti", "pases hacia el area de penalti"], group: "Pases" },
  { key: "passes_penalty_area_accurate", label: "Pases hacia el área de penalti precisos", guesses: ["pases hacia el área de penalti precisos", "pases hacia el area de penalti precisos"], group: "Pases" },
  { key: "passes_received", label: "Pases recibidos", guesses: ["pases recibidos"], group: "Pases" },
  { key: "forward_passes", label: "Pases hacia adelante", guesses: ["pases hacia adelante"], group: "Pases" },
  { key: "forward_passes_accurate", label: "Pases hacia adelante logrados", guesses: ["pases hacia adelante logrados"], group: "Pases" },
  { key: "back_passes", label: "Pases hacia atrás", guesses: ["pases hacia atrás", "pases hacia atras"], group: "Pases" },
  { key: "back_passes_accurate", label: "Pases hacia atrás logrados", guesses: ["pases hacia atrás logrados", "pases hacia atras logrados"], group: "Pases" },

  { key: "duels", label: "Duelos", guesses: ["duelos"], group: "Duelos" },
  { key: "duels_won", label: "Duelos ganados", guesses: ["duelos ganados"], group: "Duelos" },
  { key: "aerial_duels", label: "Duelos aéreos", guesses: ["duelos aéreos", "duelos aereos"], group: "Duelos" },
  { key: "aerial_duels_won", label: "Duelos aéreos ganados", guesses: ["duelos aéreos ganados", "duelos aereos ganados"], group: "Duelos" },
  { key: "interceptions", label: "Interceptaciones", guesses: ["interceptaciones"], group: "Defensivo" },
  { key: "losses", label: "Balones perdidos", guesses: ["balones perdidos"], group: "Defensivo" },
  { key: "losses_own_half", label: "Balones perdidos propia mitad", guesses: ["balones perdidos propia mitad"], group: "Defensivo" },
  { key: "recoveries", label: "Balones recuperados", guesses: ["balones recuperados"], group: "Defensivo" },
  { key: "recoveries_opp_half", label: "Balones recuperados mitad adv.", guesses: ["balones recuperados mitad adv.", "balones recuperados mitad adv"], group: "Defensivo" },
  { key: "yellow_cards", label: "Tarjeta amarilla", guesses: ["tarjeta amarilla"], group: "Defensivo" },
  { key: "red_cards", label: "Tarjeta roja", guesses: ["tarjeta roja"], group: "Defensivo" },
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
