import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerById, getPositionSeasonStats, getTeamMatchTotals, CURRENT_SEASON } from "@/lib/queries";
import { KPI_METRICS, PERCENTILE_GROUPS, POSITION_COLORS, POSITION_LABELS, formatMetric, getStat } from "@/lib/metrics";
import { computeMetricPercentiles, computePoolPercentileSpread, computeRadarValues } from "@/lib/percentiles";
import { computeShotQualityProxy } from "@/lib/xgProxy";
import { computePlayerRating, TIER_COLORS } from "@/lib/rating";
import { computeInsights } from "@/lib/insights";
import { computeSimilarPlayers } from "@/lib/similarity";
import { computeSampleWarning } from "@/lib/sampleSize";
import { formatContractRemaining, formatCurrency, formatDate, formatNumber } from "@/lib/format";
import PeerRadar from "@/components/PeerRadar";
import PercentileBars from "@/components/PercentileBars";
import ShotQualityCard from "@/components/ShotQualityCard";
import MarketValueChart from "@/components/MarketValueChart";
import KpiCard from "@/components/KpiCard";
import RatingGauge from "@/components/RatingGauge";
import InsightsCard from "@/components/InsightsCard";
import SimilarPlayersCard from "@/components/SimilarPlayersCard";
import SampleWarningBadge from "@/components/SampleWarningBadge";
import Avatar from "@/components/Avatar";
import TeamLogo from "@/components/TeamLogo";
import SummaryCard from "@/components/SummaryCard";
import { computeSummaryText } from "@/lib/summary";
import Flag from "@/components/Flag";
import ScoutingMatchChart from "@/components/ScoutingMatchChart";
import ScoutingBarList from "@/components/ScoutingBarList";
import {
  computeSummary as computeMatchLogSummary,
  cumulativeXgGoals,
  perMatchShots,
  perMatchPassPct,
  averagePassPct,
  perMatchProgression,
  perMatchDefensiveActions,
  creationTotals,
} from "@/lib/matchLogMetrics";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getPlayerById(id);
  } catch {
    notFound();
  }
  const { player, seasonStats, marketValues, matchStats } = data!;
  if (!player) notFound();

  const currentStats = seasonStats.find((s) => s.season === CURRENT_SEASON) ?? seasonStats[0] ?? null;
  const positionGroup = player.position_group ?? "MID";
  const [pool, teamMatchTotals] = await Promise.all([
    player.position_group ? getPositionSeasonStats(player.position_group) : Promise.resolve([]),
    getTeamMatchTotals(),
  ]);
  const poolStats = pool.flatMap((p) => p.season_stats);
  const sampleWarning = computeSampleWarning(
    currentStats?.matches_played,
    player.team_id ? teamMatchTotals[player.team_id] : undefined
  );
  const radarValues = computeRadarValues(poolStats, currentStats, positionGroup);
  const peerSpread = computePoolPercentileSpread(poolStats, positionGroup);
  const percentileGroups = PERCENTILE_GROUPS[positionGroup].map((g) => ({
    category: g.category,
    bars: computeMetricPercentiles(poolStats, currentStats, g.metrics),
  }));
  const shotQuality = computeShotQualityProxy(poolStats, currentStats);
  const rating = computePlayerRating(poolStats, currentStats, positionGroup);
  const insights = computeInsights(percentileGroups.flatMap((g) => g.bars), shotQuality);
  const similarPlayers = computeSimilarPlayers(pool, player.id, currentStats, positionGroup);
  const summaryText = rating
    ? computeSummaryText(
        player.full_name.split(" ")[0],
        positionGroup,
        rating.tier,
        rating.overall,
        insights,
        !!sampleWarning
      )
    : null;

  const age = getStat(currentStats, "edad");
  const latestValue = marketValues[marketValues.length - 1];
  const posColor = player.position_group ? POSITION_COLORS[player.position_group] : "var(--muted)";
  const nationalityCode = player.nationality ? player.nationality.replace(/^[a-z]{2}\s*/i, "") : "";
  const teamMatches = player.team_id ? teamMatchTotals[player.team_id] : undefined;
  const heightLabel = player.height_cm ? `${(player.height_cm / 100).toFixed(2).replace(".", ",")}m` : "—";
  const contractLabel = formatContractRemaining(player.contract_until);

  const matchLogSummary = matchStats.length > 0 ? computeMatchLogSummary(matchStats) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start gap-5">
        <Avatar src={player.photo_url} name={player.full_name} color={posColor} size={128} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted flex-wrap">
              <TeamLogo src={player.teams?.logo_url} name={player.teams?.name ?? ""} size={18} />
              {player.teams?.name ?? "Sin equipo"}
              {nationalityCode && (
                <>
                  <span aria-hidden>·</span>
                  <Flag nationality={player.nationality} size={16} />
                  <span>{nationalityCode}</span>
                </>
              )}
            </div>
            <Link
              href={`/comparar?ids=${player.id}`}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#06170e] hover:bg-accent-2 transition-colors shrink-0"
            >
              Comparar jugador
            </Link>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">{player.full_name}</h1>
            {player.position_group && (
              <span className="text-xs rounded-full bg-accent/15 text-accent-2 px-3 py-1 border border-accent/30">
                {POSITION_LABELS[player.position_group]}
              </span>
            )}
            {rating && (
              <span
                className="text-xs font-medium rounded-full px-3 py-1 border"
                style={{
                  color: TIER_COLORS[rating.tier],
                  borderColor: `${TIER_COLORS[rating.tier]}66`,
                  background: `${TIER_COLORS[rating.tier]}1a`,
                }}
              >
                {rating.tier} · {Math.round(rating.overall)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1">
            <KpiCard label="Edad" value={age ? `${age}` : "—"} />
            <KpiCard label="Estatura" value={heightLabel} />
            <KpiCard
              label="Partidos"
              value={`${currentStats?.matches_played ?? 0}`}
              hint={teamMatches ? `de ${teamMatches} posibles` : undefined}
            />
            <KpiCard label="Contrato" value={contractLabel} />
            <KpiCard
              label="Valor"
              value={latestValue ? formatCurrency(latestValue.value_amount, latestValue.currency) : "—"}
            />
          </div>
        </div>
      </div>

      {sampleWarning && <SampleWarningBadge warning={sampleWarning} />}

      {summaryText && <SummaryCard summary={summaryText} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Minutos jugados" value={formatNumber(currentStats?.minutes_played ?? undefined)} hint={`${currentStats?.matches_played ?? 0} partidos`} />
        {KPI_METRICS[positionGroup].map((m) => (
          <KpiCard key={m.key} label={m.label} value={formatMetric(getStat(currentStats, m.key), m.format)} />
        ))}
      </div>

      {rating && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-medium mb-1">Índices compuestos</h2>
          <p className="text-xs text-muted mb-4">
            Rating 0-100 por categoría, promedio de los percentiles de esa categoría frente al resto de{" "}
            {POSITION_LABELS[positionGroup].toLowerCase()}es de la liga.
          </p>
          <div className="flex flex-wrap justify-around gap-4">
            <RatingGauge label="General" value={rating.overall} color={TIER_COLORS[rating.tier]} size={104} />
            {rating.categories.map((c) => (
              <RatingGauge key={c.category} label={c.category} value={c.score} />
            ))}
          </div>
        </div>
      )}

      {matchLogSummary && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium">Partido a partido</h2>
            <span className="text-xs text-muted">{matchLogSummary.matches} partidos · fuente: FBref</span>
          </div>
          <p className="text-xs text-muted mb-4">
            Estadísticas por partido de la temporada, scrapeadas de FBref (categorías distintas a las del scouting
            externo de Wyscout).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <KpiCard label="G+A / 90" value={matchLogSummary.gaPer90.toFixed(2)} hint={`${matchLogSummary.goals}G, ${matchLogSummary.assists}A`} />
            <KpiCard label="xG total" value={matchLogSummary.xgTotal.toFixed(2)} hint={`xAG ${matchLogSummary.xagTotal.toFixed(2)}`} />
            <KpiCard
              label="% Pases completados"
              value={`${matchLogSummary.passesPct.toFixed(1)}%`}
              hint={`${matchLogSummary.passesCompleted}/${matchLogSummary.passesAttempted}`}
            />
            <KpiCard
              label="Tackles + intercepciones"
              value={`${matchLogSummary.tackles + matchLogSummary.interceptions}`}
              hint={`${matchLogSummary.tackles} tackles, ${matchLogSummary.interceptions} intercep.`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-3">xG acumulado vs. goles reales acumulados</h3>
              <ScoutingMatchChart
                data={cumulativeXgGoals(matchStats)}
                lines={[
                  { key: "xG", color: "var(--accent)" },
                  { key: "Goles", color: "var(--gold)", dashed: true },
                ]}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Tiros por partido</h3>
              <ScoutingMatchChart
                data={perMatchShots(matchStats)}
                bars={[{ key: "Tiros", color: "var(--muted)" }, { key: "Tiros al arco", color: "var(--accent)" }]}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">% Pases completados por partido</h3>
              <ScoutingMatchChart
                data={perMatchPassPct(matchStats)}
                lines={[{ key: "% Pases completados", color: "var(--accent)" }]}
                referenceValue={Math.round(averagePassPct(matchStats) * 10) / 10}
                referenceLabel="Promedio"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Progresión: pases y conducciones progresivas</h3>
              <ScoutingMatchChart
                data={perMatchProgression(matchStats)}
                bars={[
                  { key: "Pases progresivos", color: "var(--accent)" },
                  { key: "Conducciones progresivas", color: "var(--gold)" },
                ]}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Acciones defensivas por partido</h3>
              <ScoutingMatchChart
                data={perMatchDefensiveActions(matchStats)}
                bars={[
                  { key: "Tackles", color: "var(--accent)", stackId: "def" },
                  { key: "Intercepciones", color: "var(--gold)", stackId: "def" },
                  { key: "Bloqueos", color: "var(--muted)", stackId: "def" },
                ]}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Creación de juego (total temporada)</h3>
              <ScoutingBarList items={creationTotals(matchStats)} mode="count" />
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-medium mb-1">Perfil de percentiles</h2>
          <p className="text-xs text-muted mb-3">
            Comparado contra otros {POSITION_LABELS[positionGroup].toLowerCase()}es de la liga (temporada {CURRENT_SEASON}).
          </p>
          <PeerRadar
            series={[{ name: player.full_name, color: "#4ade80", values: radarValues }]}
            peers={peerSpread}
          />
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

      {shotQuality && <ShotQualityCard proxy={shotQuality} />}

      <InsightsCard insights={insights} />

      <SimilarPlayersCard players={similarPlayers} />

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
