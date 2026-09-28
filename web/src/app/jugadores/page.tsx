import { Suspense } from "react";
import {
  getPlayers,
  getTeams,
  getNationalities,
  getTeamMatchTotals,
  getSeasons,
  getLeaguesWithData,
  CURRENT_SEASON,
} from "@/lib/queries";
import type { PlayerSeasonStats, PositionGroup } from "@/lib/types";
import FilterBar from "@/components/FilterBar";
import PlayerTable from "@/components/PlayerTable";
import KpiCard from "@/components/KpiCard";
import { getStat } from "@/lib/metrics";
import { computePlayerRating, type PlayerRating } from "@/lib/rating";
import { COUNTRIES, DEFAULT_LEAGUE, leagueById, leaguesOfCountry } from "@/lib/leagues";

type SearchParams = {
  q?: string;
  position?: string;
  team?: string;
  nationality?: string;
  minMinutes?: string;
  temporada?: string;
  pais?: string;
  liga?: string;
};

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const seasons = await getSeasons();
  const season = sp.temporada && seasons.includes(sp.temporada) ? sp.temporada : CURRENT_SEASON;
  const country = sp.pais && COUNTRIES.includes(sp.pais) ? sp.pais : COUNTRIES[0];
  const league = leagueById(sp.liga);
  const leagueIds = league ? [league.id] : leaguesOfCountry(country).map((l) => l.id);
  const position = sp.position as PositionGroup | undefined;

  const [players, teams, nationalities, allPlayers, teamMatchTotals, leaguesWithData] = await Promise.all([
    getPlayers(
      {
        q: sp.q,
        position,
        team: sp.team,
        nationality: sp.nationality,
        minMinutes: sp.minMinutes ? Number(sp.minMinutes) : undefined,
        leagueIds,
      },
      season
    ),
    getTeams(),
    getNationalities(),
    getPlayers({ leagueIds }, season),
    getTeamMatchTotals(season),
    getLeaguesWithData(season),
  ]);

  // Los ratings se calculan contra jugadores de la misma liga y posición.
  const pools = new Map<string, PlayerSeasonStats[]>();
  for (const p of allPlayers) {
    const s = p.season_stats[0];
    if (!p.position_group || !s) continue;
    const key = `${s.league_id ?? DEFAULT_LEAGUE}|${p.position_group}`;
    pools.set(key, [...(pools.get(key) ?? []), s]);
  }
  const ratings: Record<string, PlayerRating | null> = {};
  for (const p of players) {
    const s = p.season_stats[0];
    ratings[p.id] =
      p.position_group && s
        ? computePlayerRating(pools.get(`${s.league_id ?? DEFAULT_LEAGUE}|${p.position_group}`) ?? [], s, p.position_group)
        : null;
  }

  const totalGoals = players.reduce((acc, p) => acc + (p.season_stats[0]?.goals ?? 0), 0);
  const avgAge =
    players.length > 0
      ? Math.round(
          (players.reduce((acc, p) => acc + (getStat(p.season_stats[0], "edad") ?? 0), 0) / players.length) * 10
        ) / 10
      : 0;
  const topScorer = [...players].sort(
    (a, b) => (b.season_stats[0]?.goals ?? 0) - (a.season_stats[0]?.goals ?? 0)
  )[0];
  const leagueWithoutData = league && !leaguesWithData.includes(league.id) ? league : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Base de jugadores</h1>
        <p className="text-muted mt-1">
          Explorá, filtrá y analizá el rendimiento de los jugadores — {league ? league.name : `ligas de ${country}`},
          temporada {season}.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Jugadores" value={players.length.toLocaleString("es-AR")} />
        <KpiCard label="Equipos" value={new Set(players.map((p) => p.season_stats[0]?.team_id).filter(Boolean)).size.toLocaleString("es-AR")} />
        <KpiCard label="Goles (filtro actual)" value={totalGoals.toLocaleString("es-AR")} />
        <KpiCard label="Edad promedio" value={avgAge ? avgAge.toFixed(1) : "—"} hint={topScorer ? `Goleador: ${topScorer.full_name}` : undefined} />
      </div>

      <Suspense>
        <FilterBar
          teams={teams}
          nationalities={nationalities}
          seasons={seasons}
          season={season}
          leaguesWithData={leaguesWithData}
        />
      </Suspense>

      {leagueWithoutData ? (
        <div className="rounded-xl border border-dashed border-gold/50 bg-surface p-6 text-sm">
          <p className="font-medium">
            {leagueWithoutData.name}: todavía sin datos cargados para {season}.
          </p>
          <p className="text-muted mt-1">
            Para esta liga hay que importar las estadísticas desde API-Football o cargarlas desde{" "}
            <a href="/cargar-datos" className="text-accent-2 hover:underline">
              Cargar datos
            </a>{" "}
            eligiendo la liga.
          </p>
        </div>
      ) : (
        <PlayerTable
          players={players}
          ratings={ratings}
          teamMatchTotals={teamMatchTotals}
          goalkeepers={position === "GK"}
          season={season}
        />
      )}
    </div>
  );
}
