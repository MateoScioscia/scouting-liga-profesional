import { notFound } from "next/navigation";
import { getScoutingPlayerById } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import Avatar from "@/components/Avatar";
import KpiCard from "@/components/KpiCard";
import RatingGauge from "@/components/RatingGauge";
import ScoutingBarList from "@/components/ScoutingBarList";
import ScoutingMatchChart from "@/components/ScoutingMatchChart";
import {
  computeSummary,
  computeProfileBars,
  computeVolumeEfficiency,
  computeOffensiveKpis,
  perMatchActionsBreakdown,
  perMatchShots,
  cumulativeXgGoals,
  duelsPctBars,
  computeBuildupKpis,
  perMatchPassPct,
  averagePassPct,
  perMatchPossessionBalance,
  perMatchPassDirection,
  crossesLongPassesTotals,
  perMatchDangerGeneration,
  computeDefensiveKpis,
  perMatchDuels,
  defensiveActionsTotals,
} from "@/lib/scoutingMetrics";

function pct(n: number): string {
  return `${formatNumber(n, 1)}%`;
}

export default async function ScoutingPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getScoutingPlayerById(id);
  } catch {
    notFound();
  }
  const { player, matches } = data!;
  if (!player) notFound();
  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <p className="text-muted">Este jugador todavía no tiene partidos cargados.</p>
      </div>
    );
  }

  const summary = computeSummary(matches);
  const profileBars = computeProfileBars(matches);
  const volumeEfficiency = computeVolumeEfficiency(matches);
  const offensiveKpis = computeOffensiveKpis(matches);
  const actionsBreakdown = perMatchActionsBreakdown(matches);
  const shots = perMatchShots(matches);
  const xgVsGoals = cumulativeXgGoals(matches);
  const duelsBars = duelsPctBars(matches);
  const buildupKpis = computeBuildupKpis(matches);
  const passPct = perMatchPassPct(matches);
  const avgPassPct = averagePassPct(matches);
  const possessionBalance = perMatchPossessionBalance(matches);
  const passDirection = perMatchPassDirection(matches);
  const crossesLongPasses = crossesLongPassesTotals(matches);
  const dangerGeneration = perMatchDangerGeneration(matches);
  const defensiveKpis = computeDefensiveKpis(matches);
  const duels = perMatchDuels(matches);
  const defensiveTotals = defensiveActionsTotals(matches);

  const positions = Array.from(new Set(matches.map((m) => m.position_specific).filter(Boolean))).join(", ");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start gap-5">
        <Avatar src={player.photo_url} name={player.full_name} color="var(--accent)" size={96} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="text-xs text-muted uppercase tracking-wide">Scouting externo</div>
          <h1 className="text-2xl font-semibold tracking-tight">{player.full_name}</h1>
          <p className="text-sm text-muted">
            {positions || player.position} — {player.nationality}. {player.league}
          </p>
          <p className="text-sm text-muted">
            {summary.matches} partidos — {summary.goals} gol{summary.goals === 1 ? "" : "es"} — {summary.assists}{" "}
            asistencia{summary.assists === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xl font-medium mb-4">Resumen</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="G + A por 90'" value={formatNumber(summary.gaPer90, 2)} hint={`${summary.goals}G + ${summary.assists}A / ${summary.minutes} min`} />
          <KpiCard label="xG Total" value={formatNumber(summary.xgTotal, 2)} hint={`${summary.goals} gol${summary.goals === 1 ? "" : "es"}`} />
          <KpiCard label="% Acciones" value={pct(summary.actionsPct)} hint={`${summary.actionsSuccessful} / ${summary.actionsTotal} tot.`} />
          <KpiCard label="% Pases" value={pct(summary.passesPct)} hint={`${summary.passesAccurate} / ${summary.passes} tot.`} />
          <KpiCard label="Bal. Posesión" value={formatNumber(summary.possessionBalance)} hint={`${summary.recoveries} Rec / ${summary.losses} Perd.`} />
          <KpiCard
            label="Índice pressing (90')"
            value={formatNumber(summary.pressingPer90, 1)}
            hint={`${summary.pressingTotal} tot. (${summary.interceptions} Int + ${summary.recoveriesOppHalf} Rec)`}
          />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Resumen jugador</h3>
            <ScoutingBarList items={profileBars} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Balance de rendimiento: volumen de juego vs. eficacia</h3>
            <ScoutingMatchChart
              data={volumeEfficiency}
              bars={[{ key: "Acciones totales", color: "var(--gold)" }]}
              lines={[{ key: "% Acciones con éxito", color: "var(--accent)", yAxisId: "right" }]}
              dualAxis
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xl font-medium mb-4">Acciones ofensivas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <KpiCard label="G + A por 90'" value={formatNumber(offensiveKpis.gaPer90, 2)} />
          <KpiCard label="xG Total" value={formatNumber(offensiveKpis.xgTotal, 2)} />
          <KpiCard label="Tiros por partido" value={formatNumber(offensiveKpis.shotsPerMatch, 1)} />
          <KpiCard label="Toques área penalti / partido" value={formatNumber(offensiveKpis.penaltyTouchesPerMatch, 1)} />
          <KpiCard label="% Regates eficaces" value={pct(offensiveKpis.dribblesPct)} />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Acciones logradas vs. falladas por partido</h3>
            <ScoutingMatchChart
              data={actionsBreakdown}
              bars={[
                { key: "Falladas", color: "var(--danger)", stackId: "a" },
                { key: "Logradas", color: "var(--accent)", stackId: "a" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Tiros totales vs. tiros al arco</h3>
            <ScoutingMatchChart
              data={shots}
              bars={[
                { key: "Tiros", color: "var(--gold)" },
                { key: "Tiros logrados", color: "var(--accent)" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">xG acumulado vs. goles reales acumulados</h3>
            <ScoutingMatchChart
              data={xgVsGoals}
              lines={[
                { key: "xG", color: "var(--accent-2)" },
                { key: "Goles", color: "var(--gold)" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">% Duelos ganados</h3>
            <ScoutingBarList items={duelsBars} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xl font-medium mb-4">Construcción de juego</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="% Pases completos" value={pct(buildupKpis.passesPct)} />
          <KpiCard label="% Pases largos" value={pct(buildupKpis.longPassesPct)} />
          <KpiCard label="% Pases últ. tercio" value={pct(buildupKpis.finalThirdPct)} />
          <KpiCard label="% Pases adelante" value={pct(buildupKpis.forwardPassesPct)} />
          <KpiCard label="% Pases área penalti" value={pct(buildupKpis.penaltyAreaPassesPct)} />
          <KpiCard label="% Pases atrás" value={pct(buildupKpis.backPassesPct)} />
        </div>
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium mb-3">% Pases logrados por partido</h3>
            <ScoutingMatchChart data={passPct} lines={[{ key: "% Pases logrados", color: "var(--danger)" }]} referenceValue={Math.round(avgPassPct * 10) / 10} referenceLabel="Promedio" />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Balance de balones recuperados vs. perdidos</h3>
            <ScoutingMatchChart data={possessionBalance} bars={[{ key: "Balance", color: "var(--danger)" }]} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Dirección de pases por partido</h3>
            <ScoutingMatchChart
              data={passDirection}
              bars={[
                { key: "Pases hacia atrás", color: "var(--accent)", stackId: "a" },
                { key: "Pases hacia adelante", color: "var(--gold)", stackId: "a" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Efectividad en envíos: centros y pases largos</h3>
            <ScoutingBarList items={crossesLongPasses} color="var(--gold)" mode="count" />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="text-sm font-medium mb-3">Generación de peligro: pases clave y centros por partido</h3>
            <ScoutingMatchChart
              data={dangerGeneration}
              bars={[
                { key: "Pases en profundidad", color: "var(--accent)", stackId: "a" },
                { key: "Pases en el último tercio", color: "var(--gold)", stackId: "a" },
                { key: "Centros", color: "#60a5fa", stackId: "a" },
              ]}
            />
          </div>
          <div className="flex justify-center">
            <RatingGauge label="Eficacia asociativa general (% pases logrados)" value={buildupKpis.passesPct} color="var(--accent)" size={140} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xl font-medium mb-4">Acciones defensivas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <KpiCard label="Tarjetas amarillas" value={formatNumber(defensiveKpis.yellowCards)} />
          <KpiCard label="Intercepciones" value={formatNumber(defensiveKpis.interceptions)} />
          <KpiCard label="Recuperaciones" value={formatNumber(defensiveKpis.recoveries)} />
          <KpiCard label="Recuperaciones campo rival" value={formatNumber(defensiveKpis.recoveriesOppHalf)} />
          <KpiCard label="Duelos ganados / partido" value={formatNumber(defensiveKpis.duelsWonPerMatch, 1)} />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Duelos totales por partido</h3>
            <ScoutingMatchChart
              data={duels}
              bars={[
                { key: "Duelos", color: "var(--accent)", stackId: "a" },
                { key: "Duelos ofensivos", color: "var(--gold)", stackId: "a" },
                { key: "Duelos aéreos", color: "#60a5fa", stackId: "a" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Balones recuperados e intercepciones (total)</h3>
            <ScoutingBarList items={defensiveTotals} color="var(--accent)" mode="count" />
          </div>
        </div>
      </div>
    </div>
  );
}
