export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};

export type Player = {
  id: string;
  full_name: string;
  nationality: string;
  birth_date: string | null;
  position: string | null;
  position_group: PositionGroup | null;
  team_id: string | null;
  photo_url: string | null;
  height_cm: number | null;
  contract_until: string | null;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  teams: Team | null;
};

export type PlayerSeasonStats = {
  id: string;
  player_id: string;
  season: string;
  team_id: string | null;
  matches_played: number | null;
  starts: number | null;
  minutes_played: number | null;
  nineties: number | null;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  stats: Record<string, number>;
};

export type MarketValue = {
  id: string;
  player_id: string;
  value_date: string;
  value_amount: number;
  currency: string;
  source: string | null;
};

export type PlayerWithStats = Player & {
  season_stats: PlayerSeasonStats[];
};

// Partido a partido para jugadores del plantel LPF, scrapeado de FBref
// (ver scripts/fetch_fbref_matchlogs.py). Columnas mas limitadas que el
// scouting externo (que viene de un export de Wyscout) pero cubre a todo
// el plantel en vez de un jugador puntual.
export type PlayerMatchStat = {
  id: string;
  player_id: string;
  match_date: string;
  competition: string | null;
  round: string | null;
  venue: string | null;
  opponent: string | null;
  result_code: string | null;
  started: boolean | null;
  position_specific: string | null;
  minutes_played: number;
  goals: number;
  assists: number;
  penalty_goals: number;
  penalty_attempts: number;
  shots: number;
  shots_on_target: number;
  yellow_cards: number;
  red_cards: number;
  touches: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  xg: number;
  npxg: number;
  xag: number;
  sca: number;
  gca: number;
  passes_completed: number;
  passes_attempted: number;
  progressive_passes: number;
  carries: number;
  progressive_carries: number;
  take_ons_attempted: number;
  take_ons_successful: number;
};

// Objetivos de scouting externo: jugadores de otras ligas evaluados con
// reportes partido a partido (no forman parte del roster de la Liga
// Profesional, que solo tiene stats agregadas por temporada).
export type ScoutingPlayer = {
  id: string;
  full_name: string;
  nationality: string | null;
  position: string | null;
  club: string | null;
  league: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ScoutingMatchStat = {
  id: string;
  scouting_player_id: string;
  match_number: number | null;
  opponent: string;
  result_code: string | null;
  score: string | null;
  competition: string | null;
  match_date: string;
  position_specific: string | null;
  minutes_played: number;
  actions_total: number;
  actions_successful: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  xg: number;
  shot_assists: number;
  crosses: number;
  crosses_accurate: number;
  dribbles: number;
  dribbles_successful: number;
  offensive_duels: number;
  offensive_duels_won: number;
  penalty_area_touches: number;
  offsides: number;
  deep_runs: number;
  fouls_suffered: number;
  passes: number;
  passes_accurate: number;
  long_passes: number;
  long_passes_accurate: number;
  deep_passes: number;
  deep_passes_accurate: number;
  xa: number;
  passes_final_third: number;
  passes_final_third_accurate: number;
  passes_penalty_area: number;
  passes_penalty_area_accurate: number;
  passes_received: number;
  forward_passes: number;
  forward_passes_accurate: number;
  back_passes: number;
  back_passes_accurate: number;
  duels: number;
  duels_won: number;
  aerial_duels: number;
  aerial_duels_won: number;
  interceptions: number;
  losses: number;
  losses_own_half: number;
  recoveries: number;
  recoveries_opp_half: number;
  yellow_cards: number;
  red_cards: number;
};
