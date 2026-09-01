import Link from "next/link";
import { getPlayerIndex, getPlayerById, getPositionSeasonStats } from "@/lib/queries";
import { computePoolPercentileSpread, computeRadarValues, type PeerSpread } from "@/lib/percentiles";
import { POSITION_LABELS, getStat, formatMetric } from "@/lib/metrics";
import ComparePicker from "@/components/ComparePicker";
import PeerRadar, { type RadarSeries } from "@/components/PeerRadar";
import type { PositionGroup } from "@/lib/types";

const COLORS = ["#4ade80", "#facc15", "#38bdf8", "#f472b6"];

const GENERIC_METRICS: { key: string; label: string; format?: "pct" | "int" | "dec" }[] = [
  { key: "minutes_played", label: "Minutos jugados", format: "int" },
  { key: "matches_played", label: "Partidos jugados", format: "int" },
  { key: "goals", label: "Goles", format: "int" },
  { key: "assists", label: "Asistencias", format: "int" },
  { key: "goles_p90", label: "Goles / 90", format: "dec" },
  { key: "asistencias_p90", label: "Asistencias / 90", format: "dec" },
  { key: "intercepciones_p90", label: "Intercepciones / 90", format: "dec" },
  { key: "entradas_p90", label: "Entradas / 90", format: "dec" },
  { key: "yellow_cards", label: "Amarillas", format: "int" },
  { key: "red_cards", label: "Rojas", format: "int" },
];

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);

  const index = await getPlayerIndex();

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comparar jugadores</h1>
          <p className="text-muted mt-1">Elegí entre 2 y 4 jugadores para ver su perfil lado a lado.</p>
        </div>
        <ComparePicker index={index} selectedIds={[]} />
      </div>
    );
  }

  const players = await Promise.all(ids.map((id) => getPlayerById(id).catch(() => null)));
  const valid = players.filter((p): p is NonNullable<typeof p> => p !== null && !!p.player);

  const groups = new Set(valid.map((p) => p.player.position_group).filter(Boolean));
  const sameGroup = groups.size === 1 ? (valid[0].player.position_group as PositionGroup) : null;

  let radarSeries: RadarSeries[] = [];
  let peerSpread: PeerSpread[] = [];
  if (sameGroup) {
    const pool = await getPositionSeasonStats(sameGroup);
    const poolStats = pool.flatMap((p) => p.season_stats);
    radarSeries = valid.map((p, i) => ({
      name: p.player.full_name,
      color: COLORS[i % COLORS.length],
      values: computeRadarValues(poolStats, p.seasonStats[0] ?? null, sameGroup),
    }));
    peerSpread = computePoolPercentileSpread(poolStats, sameGroup);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comparar jugadores</h1>
        <p className="text-muted mt-1">Elegí entre 2 y 4 jugadores para ver su perfil lado a lado.</p>
      </div>

      <ComparePicker index={index} selectedIds={valid.map((p) => p.player.id)} />

      {valid.length === 1 && (
        <p className="text-muted text-sm">Agregá al menos un jugador más para comparar.</p>
      )}

      {valid.length >= 2 && (
        <>
          {sameGroup ? (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="font-medium mb-1">Perfil de percentiles — {POSITION_LABELS[sameGroup]}es</h2>
              <p className="text-xs text-muted mb-3">Percentil respecto al resto de la posición en la liga.</p>
              <PeerRadar series={radarSeries} peers={peerSpread} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm text-muted">
                Los jugadores seleccionados juegan en distintas posiciones, así que el radar de percentiles no es
                comparable entre ellos. Usá la tabla de abajo para comparar sus números.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5 overflow-x-auto scrollbar-thin">
            <h2 className="font-medium mb-3">Tabla comparativa</h2>
            <table className="text-sm min-w-full">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-4 font-medium">Métrica</th>
                  {valid.map((p, i) => (
                    <th key={p.player.id} className="py-2 px-3 font-medium whitespace-nowrap">
                      <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: COLORS[i % COLORS.length] }} />
                      <Link href={`/jugadores/${p.player.id}`} className="hover:text-accent-2">
                        {p.player.full_name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted">Posición</td>
                  {valid.map((p) => (
                    <td key={p.player.id} className="py-2 px-3">
                      {p.player.position_group ? POSITION_LABELS[p.player.position_group] : "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted">Equipo</td>
                  {valid.map((p) => (
                    <td key={p.player.id} className="py-2 px-3">
                      {p.player.teams?.name ?? "—"}
                    </td>
                  ))}
                </tr>
                {GENERIC_METRICS.map((m) => (
                  <tr key={m.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 text-muted">{m.label}</td>
                    {valid.map((p) => (
                      <td key={p.player.id} className="py-2 px-3 tabular-nums">
                        {formatMetric(getStat(p.seasonStats[0], m.key), m.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
