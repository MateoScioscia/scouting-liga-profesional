import { Suspense } from "react";
import { getPlayers, getTeams, getNationalities, getTeamMatchTotals } from "@/lib/queries";
import type { PlayerSeasonStats, PositionGroup } from "@/lib/types";
import FilterBar from "@/components/FilterBar";
import PlayerTable from "@/components/PlayerTable";
import KpiCard from "@/components/KpiCard";
import { getStat } from "@/lib/metrics";
import { computePlayerRating, type PlayerRating } from "@/lib/rating";

type SearchParams = {
  q?: string;
  position?: string;
  team?: string;
  nationality?: string;
  minMinutes?: string;
};

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [players, teams, nationalities, allPlayers, teamMatchTotals] = await Promise.all([
    getPlayers({
      q: sp.q,
      position: sp.position as PositionGroup | undefined,
      team: sp.team,
      nationality: sp.nationality,
      minMinutes: sp.minMinutes ? Number(sp.minMinutes) : undefined,
    }),
    getTeams(),
    getNationalities(),
    getPlayers({}),
    getTeamMatchTotals(),
  ]);

  const poolsByPosition: Record<PositionGroup, PlayerSeasonStats[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of allPlayers) {
    if (p.position_group) poolsByPosition[p.position_group].push(...p.season_stats);
  }
  const ratings: Record<string, PlayerRating | null> = {};
  for (const p of players) {
    ratings[p.id] = p.position_group
      ? computePlayerRating(poolsByPosition[p.position_group], p.season_stats[0] ?? null, p.position_group)
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Base de jugadores</h1>
        <p className="text-muted mt-1">
          Explorá, filtrá y analizá el rendimiento de los jugadores de la Liga Profesional Argentina — temporada 2026.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Jugadores" value={players.length.toLocaleString("es-AR")} />
        <KpiCard label="Equipos" value={teams.length.toLocaleString("es-AR")} />
        <KpiCard label="Goles (filtro actual)" value={totalGoals.toLocaleString("es-AR")} />
        <KpiCard label="Edad promedio" value={avgAge ? avgAge.toFixed(1) : "—"} hint={topScorer ? `Goleador: ${topScorer.full_name}` : undefined} />
      </div>

      <Suspense>
        <FilterBar teams={teams} nationalities={nationalities} />
      </Suspense>

      <PlayerTable players={players} ratings={ratings} teamMatchTotals={teamMatchTotals} />
    </div>
  );
}
