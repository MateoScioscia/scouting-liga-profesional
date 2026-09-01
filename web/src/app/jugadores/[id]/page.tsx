import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerById, getPositionSeasonStats, CURRENT_SEASON } from "@/lib/queries";
import { KPI_METRICS, PERCENTILE_GROUPS, POSITION_LABELS, formatMetric, getStat } from "@/lib/metrics";
import { computeMetricPercentiles, computeRadarValues } from "@/lib/percentiles";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import PlayerRadar from "@/components/PlayerRadar";
import PercentileBars from "@/components/PercentileBars";
import MarketValueChart from "@/components/MarketValueChart";
import KpiCard from "@/components/KpiCard";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getPlayerById(id);
  } catch {
    notFound();
  }
  const { player, seasonStats, marketValues } = data!;
  if (!player) notFound();

  const currentStats = seasonStats.find((s) => s.season === CURRENT_SEASON) ?? seasonStats[0] ?? null;
  const positionGroup = player.position_group ?? "MID";
  const pool = player.position_group ? await getPositionSeasonStats(player.position_group) : [];
  const poolStats = pool.flatMap((p) => p.season_stats);
  const radarValues = computeRadarValues(poolStats, currentStats, positionGroup);
  const percentileGroups = PERCENTILE_GROUPS[positionGroup].map((g) => ({
    category: g.category,
    bars: computeMetricPercentiles(poolStats, currentStats, g.metrics),
  }));

  const age = getStat(currentStats, "edad");
  const latestValue = marketValues[marketValues.length - 1];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">{player.full_name}</h1>
            {player.position_group && (
              <span className="text-xs rounded-full bg-accent/15 text-accent-2 px-3 py-1 border border-accent/30">
                {POSITION_LABELS[player.position_group]}
              </span>
            )}
          </div>
          <p className="text-muted mt-1">
            {player.teams?.name ?? "Sin equipo"} · {player.nationality || "Nacionalidad no informada"}
            {age ? ` · ${age} años` : ""}
          </p>
        </div>
        <Link
          href={`/comparar?ids=${player.id}`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#06170e] hover:bg-accent-2 transition-colors shrink-0"
        >
          Comparar jugador
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Minutos jugados" value={formatNumber(currentStats?.minutes_played ?? undefined)} hint={`${currentStats?.matches_played ?? 0} partidos`} />
        {KPI_METRICS[positionGroup].map((m) => (
          <KpiCard key={m.key} label={m.label} value={formatMetric(getStat(currentStats, m.key), m.format)} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-medium mb-1">Perfil de percentiles</h2>
          <p className="text-xs text-muted mb-3">
            Comparado contra otros {POSITION_LABELS[positionGroup].toLowerCase()}es de la liga (temporada {CURRENT_SEASON}).
          </p>
          <PlayerRadar series={[{ name: player.full_name, color: "#4ade80", values: radarValues }]} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium">Valor de mercado</h2>
            {latestValue && (
              <span className="text-lg font-semibold text-gold">{formatCurrency(latestValue.value_amount, latestValue.currency)}</span>
            )}
          </div>
          <p className="text-xs text-muted mb-3">Evolución histórica cargada manualmente.</p>
          <MarketValueChart values={marketValues} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium mb-1">Reporte de percentiles</h2>
        <p className="text-xs text-muted mb-4">
          Cada barra muestra el percentil de {player.full_name.split(" ")[0]} frente al resto de{" "}
          {POSITION_LABELS[positionGroup].toLowerCase()}es de la liga (temporada {CURRENT_SEASON}). Más verde y más
          larga = mejor ubicado en el grupo.
        </p>
        <PercentileBars groups={percentileGroups} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 overflow-x-auto scrollbar-thin">
        <h2 className="font-medium mb-3">Estadísticas completas — temporada {currentStats?.season ?? CURRENT_SEASON}</h2>
        {currentStats ? (
          <table className="text-sm min-w-full">
            <tbody>
              {Object.entries({
                "Partidos jugados": currentStats.matches_played,
                Titular: currentStats.starts,
                "Minutos jugados": currentStats.minutes_played,
                "90s jugados": currentStats.nineties,
                Goles: currentStats.goals,
                Asistencias: currentStats.assists,
                Amarillas: currentStats.yellow_cards,
                Rojas: currentStats.red_cards,
                ...currentStats.stats,
              }).map(([key, value]) => (
                <tr key={key} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-6 text-muted capitalize whitespace-nowrap">{key.replaceAll("_", " ")}</td>
                  <td className="py-1.5 tabular-nums">{formatNumber(typeof value === "number" ? value : undefined, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm">Sin estadísticas cargadas para este jugador.</p>
        )}
      </div>

      {seasonStats.length > 1 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-medium mb-3">Temporadas cargadas</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {seasonStats.map((s) => (
              <span key={s.id} className="rounded-full border border-border px-3 py-1 text-muted">
                {s.season}: {s.minutes_played ?? 0}&apos; · {s.goals ?? 0}G · {s.assists ?? 0}A
              </span>
            ))}
          </div>
        </div>
      )}

      {marketValues.length > 0 && (
        <p className="text-xs text-muted">Última actualización de valor: {formatDate(latestValue.value_date)}</p>
      )}
    </div>
  );
}
