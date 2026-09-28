// Ligas cubiertas por el sistema. La tabla `leagues` de Supabase tiene los
// mismos ids (ver supabase/migrations); acá se repiten para armar filtros sin
// una consulta extra. Cada fila de player_season_stats guarda en qué liga se
// jugó esa temporada (`league_id`), porque un club puede ascender o descender.
export type League = {
  id: string;
  name: string;
  short: string;
  country: string;
  tier: number;
};

export const LEAGUES: League[] = [
  { id: "LPF", name: "Primera División (Liga Profesional)", short: "Primera División", country: "Argentina", tier: 1 },
  { id: "PN", name: "Primera Nacional", short: "Primera Nacional", country: "Argentina", tier: 2 },
  { id: "BM", name: "Primera B Metropolitana", short: "Primera B Metro", country: "Argentina", tier: 3 },
  { id: "FA", name: "Torneo Federal A", short: "Federal A", country: "Argentina", tier: 3 },
  { id: "PC", name: "Primera C", short: "Primera C", country: "Argentina", tier: 4 },
];

export const DEFAULT_LEAGUE = "LPF";

export const COUNTRIES = Array.from(new Set(LEAGUES.map((l) => l.country)));

export function leagueById(id: string | null | undefined): League | undefined {
  return LEAGUES.find((l) => l.id === id);
}

export function leaguesOfCountry(country: string | undefined): League[] {
  return country ? LEAGUES.filter((l) => l.country === country) : LEAGUES;
}
