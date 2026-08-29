import { getSupabase } from "./supabase";
import type { Player, PlayerSeasonStats, MarketValue, PositionGroup, Team } from "./types";

export const CURRENT_SEASON = "2026";

export type PlayerListItem = Player & { season_stats: PlayerSeasonStats[] };

export type PlayerFilters = {
  q?: string;
  position?: PositionGroup;
  team?: string;
  nationality?: string;
  minMinutes?: number;
  maxAge?: number;
  minAge?: number;
};

export async function getTeams() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("teams").select("id, name").order("name");
  if (error) throw error;
  return data;
}

export async function getNationalities() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select("nationality")
    .neq("nationality", "");
  if (error) throw error;
  const set = new Set((data ?? []).map((r) => r.nationality));
  return Array.from(set).sort();
}

export async function getPlayers(filters: PlayerFilters, season = CURRENT_SEASON): Promise<PlayerListItem[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("players")
    .select(
      "*, teams(id, name), season_stats:player_season_stats!inner(id, player_id, season, team_id, matches_played, starts, minutes_played, nineties, goals, assists, yellow_cards, red_cards, stats)"
    )
    .eq("player_season_stats.season", season)
    .limit(1000);

  if (filters.q) query = query.ilike("full_name", `%${filters.q}%`);
  if (filters.position) query = query.eq("position_group", filters.position);
  if (filters.team) query = query.eq("team_id", filters.team);
  if (filters.nationality) query = query.eq("nationality", filters.nationality);
  if (filters.minMinutes !== undefined) query = query.gte("player_season_stats.minutes_played", filters.minMinutes);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PlayerListItem[];
}

export type PlayerIndexItem = {
  id: string;
  full_name: string;
  position_group: PositionGroup | null;
  teams: Team | null;
};

export async function getPlayerIndex(season = CURRENT_SEASON): Promise<PlayerIndexItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, position_group, teams(id, name), player_season_stats!inner(season)")
    .eq("player_season_stats.season", season)
    .order("full_name")
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as PlayerIndexItem[];
}

export async function getPlayerById(id: string) {
  const supabase = getSupabase();
  const { data: player, error } = await supabase
    .from("players")
    .select("*, teams(id, name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: seasonStats } = await supabase
    .from("player_season_stats")
    .select("*")
    .eq("player_id", id)
    .order("season", { ascending: false });

  const { data: marketValues } = await supabase
    .from("market_values")
    .select("*")
    .eq("player_id", id)
    .order("value_date", { ascending: true });

  return {
    player: player as Player,
    seasonStats: (seasonStats ?? []) as PlayerSeasonStats[],
    marketValues: (marketValues ?? []) as MarketValue[],
  };
}

// Trae, para un grupo posicional y temporada, todas las filas de stats
// (liviano: sin datos del jugador) para poder calcular percentiles.
export async function getPositionSeasonStats(positionGroup: PositionGroup, season = CURRENT_SEASON) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select(
      "id, season_stats:player_season_stats!inner(season, matches_played, starts, minutes_played, nineties, goals, assists, yellow_cards, red_cards, stats)"
    )
    .eq("position_group", positionGroup)
    .eq("player_season_stats.season", season)
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as { id: string; season_stats: PlayerSeasonStats[] }[];
}
