import Link from "next/link";
import type { PlayerSeasonStats, PositionGroup } from "@/lib/types";
import { formatMetric, getStat } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { leagueById } from "@/lib/leagues";
import { KEY_METRIC, keyMetricValue, type SeasonPercentiles } from "@/lib/evolution";
import ScoutingMatchChart from "./ScoutingMatchChart";

function pctStyle(pct: number) {
  const bg = pct >= 80 ? "#3ddc76" : pct >= 60 ? "#23a055" : pct >= 40 ? "#2f6e4b" : "#3a4d45";
  return { background: bg, color: pct >= 60 ? "#06170e" : "var(--foreground)" };
}

export default function EvolutionCard({
  playerId,
  seasons,
  currentSeason,
  positionGroup,
  teamNames,
  percentiles,
  minMinutes,
}: {
  playerId: string;
  seasons: PlayerSeasonStats[];
  currentSeason: string;
  positionGroup: PositionGroup;
  teamNames: Record<string, string>;
  percentiles: SeasonPercentiles[];
  minMinutes: number;
}) {
  const ordered = [...seasons].sort((a, b) => a.season.localeCompare(b.season));
  const gk = positionGroup === "GK";
  const key = KEY_METRIC[positionGroup];

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Evolución por temporada</h2>
        <p className="text-sm text-muted mt-1">Sin temporadas cargadas.</p>
      </div>
    );
  }

  const chartData = ordered.map((s) => ({
    label: s.season,
    Minutos: s.minutes_played ?? 0,
    [key.short]: Math.round((keyMetricValue(s, positionGroup) ?? 0) * 100) / 100,
  }));

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-6">
      <div>
        <h2 className="font-medium">Evolución por temporada</h2>
        <p className="text-xs text-muted mt-1">
          Cada temporada se compara contra los jugadores de su misma posición y liga en esa temporada.
          {ordered.length === 1 && " Por ahora hay una sola temporada cargada: la evolución aparece cuando se importen las anteriores."}
        </p>
      </div>

      {ordered.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Minutos por temporada</h3>
            <ScoutingMatchChart data={chartData} bars={[{ key: "Minutos", color: "#3987e5" }]} height={220} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">{key.label} por temporada</h3>
            <ScoutingMatchChart data={chartData} lines={[{ key: key.short, color: "#3987e5" }]} height={220} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <h3 className="text-sm font-medium mb-2">Temporada por temporada</h3>
        <table className="text-sm min-w-full tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Temporada</th>
              <th className="py-2 px-3 font-medium">Liga</th>
              <th className="py-2 px-3 font-medium">Club</th>
              <th className="py-2 px-3 font-medium">PJ</th>
              <th className="py-2 px-3 font-medium">Tit.</th>
              <th className="py-2 px-3 font-medium">Min</th>
              {gk ? (
                <>
                  <th className="py-2 px-3 font-medium" title="Arco en 0">Arc en 0</th>
                  <th className="py-2 px-3 font-medium" title="Goles en contra">GC</th>
                  <th className="py-2 px-3 font-medium" title="Paradas por partido">PPP</th>
                </>
              ) : (
                <>
                  <th className="py-2 px-3 font-medium">G</th>
                  <th className="py-2 px-3 font-medium">A</th>
                </>
              )}
              <th className="py-2 px-3 font-medium">{key.short}</th>
              <th className="py-2 px-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {[...ordered].reverse().map((s) => {
              const current = s.season === currentSeason;
              const saves = getStat(s, "atajadas");
              return (
                <tr key={s.id} className={`border-b border-border/50 last:border-0 ${current ? "bg-accent/10" : ""}`}>
                  <td className="py-2 pr-4 font-medium">{s.season}</td>
                  <td className="py-2 px-3">{leagueById(s.league_id)?.short ?? s.league_id}</td>
                  <td className="py-2 px-3">{s.team_id ? teamNames[s.team_id] ?? "—" : "—"}</td>
                  <td className="py-2 px-3">{s.matches_played ?? 0}</td>
                  <td className="py-2 px-3">{s.starts ?? 0}</td>
                  <td className="py-2 px-3">{formatNumber(s.minutes_played ?? 0)}</td>
                  {gk ? (
                    <>
                      <td className="py-2 px-3">{formatMetric(getStat(s, "vallas_invictas"), "int")}</td>
                      <td className="py-2 px-3">{formatMetric(getStat(s, "goles_recibidos"), "int")}</td>
                      <td className="py-2 px-3">
                        {saves !== null && s.matches_played ? formatNumber(saves / s.matches_played, 1) : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3">{s.goals ?? 0}</td>
                      <td className="py-2 px-3">{s.assists ?? 0}</td>
                    </>
                  )}
                  <td className="py-2 px-3">{formatMetric(keyMetricValue(s, positionGroup), key.format)}</td>
                  <td className="py-2 px-3 text-right">
                    {current ? (
                      <span className="text-xs text-muted">viendo</span>
                    ) : (
                      <Link href={`/jugadores/${playerId}?temporada=${s.season}`} className="text-xs text-accent-2 hover:underline whitespace-nowrap">
                        Ver temporada →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ordered.length > 1 && (
        <div className="overflow-x-auto scrollbar-thin">
          <h3 className="text-sm font-medium mb-2">Percentiles por temporada</h3>
          <table className="text-sm min-w-full tabular-nums">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4 font-medium">Métrica</th>
                {ordered.map((s) => (
                  <th key={s.season} className="py-2 px-3 font-medium text-center">
                    {s.season}
                  </th>
                ))}
                <th className="py-2 px-3 font-medium text-right">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {percentiles.map((row) => (
                <tr key={row.metric.key} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4">{row.metric.label}</td>
                  {ordered.map((s) => {
                    const pct = row.bySeason[s.season];
                    const small = (s.minutes_played ?? 0) < minMinutes;
                    return (
                      <td key={s.season} className="py-2 px-3 text-center">
                        {pct === null || pct === undefined ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className="inline-block min-w-11 rounded px-1.5 py-0.5 text-xs font-semibold" style={pctStyle(pct)}>
                            P{pct}
                            {small ? "*" : ""}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-right font-semibold">
                    {row.change === null ? (
                      <span className="text-muted">—</span>
                    ) : row.change > 0 ? (
                      <span className="text-accent-2">▲ +{row.change}</span>
                    ) : row.change < 0 ? (
                      <span className="text-danger">▼ {row.change}</span>
                    ) : (
                      <span className="text-muted">= 0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted mt-2">* muestra chica: menos de {minMinutes} minutos en esa temporada.</p>
        </div>
      )}
    </div>
  );
}
