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
