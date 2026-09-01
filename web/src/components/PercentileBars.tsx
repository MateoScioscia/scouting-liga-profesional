import { formatMetric } from "@/lib/metrics";
import type { PercentileBar } from "@/lib/percentiles";

function bucketColor(pct: number): string {
  if (pct < 20) return "#f87171";
  if (pct < 40) return "#fb923c";
  if (pct < 60) return "#facc15";
  if (pct < 80) return "#a3e635";
  return "#4ade80";
}

export default function PercentileBars({
  groups,
}: {
  groups: { category: string; bars: PercentileBar[] }[];
}) {
  const hasData = groups.some((g) => g.bars.some((b) => b.raw !== null));
  if (!hasData) {
    return <div className="text-muted text-sm">Sin métricas suficientes para el reporte de percentiles.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.category}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-2">{g.category}</h3>
          <div className="flex flex-col gap-2.5">
            {g.bars.map(({ metric, raw, pct }) => (
              <div key={metric.key} className="flex items-center gap-3 text-sm">
                <div className="w-40 shrink-0 text-muted truncate" title={metric.label}>
                  {metric.label}
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(pct, 2)}%`, background: bucketColor(pct) }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right tabular-nums">{formatMetric(raw, metric.format)}</div>
                <div className="w-9 shrink-0 text-right tabular-nums text-xs text-muted">{Math.round(pct)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
