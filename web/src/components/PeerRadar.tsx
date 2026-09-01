import type { PeerSpread } from "@/lib/percentiles";

export type RadarSeries = {
  name: string;
  color: string;
  values: { metric: string; value: number }[];
};

const SIZE = 380;
const CENTER = SIZE / 2;
const MAX_R = 148;
const RINGS = [20, 40, 60, 80, 100];

function point(angle: number, r: number) {
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

// Jitter angular determinístico (sin Math.random) para dispersar los puntos
// de pares dentro de su "cuña" sin que se pisen unos con otros.
function jitter(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function PeerRadar({ series, peers }: { series: RadarSeries[]; peers: PeerSpread[] }) {
  if (series.length === 0 || series[0].values.length === 0) {
    return <div className="text-muted text-sm">Sin métricas suficientes para el radar.</div>;
  }

  const metrics = series[0].values.map((v) => v.metric);
  const n = metrics.length;
  const step = (2 * Math.PI) / n;
  const wedge = step * 0.68;
  const axisAngle = (i: number) => -Math.PI / 2 + i * step;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" className="max-w-[420px]">
        {RINGS.map((r) => (
          <circle key={r} cx={CENTER} cy={CENTER} r={(r / 100) * MAX_R} stroke="var(--border)" strokeWidth={1} fill="none" />
        ))}

        {metrics.map((_, i) => {
          const p = point(axisAngle(i), MAX_R);
          return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1} />;
        })}

        {peers.map((peer, i) => {
          const angle = axisAngle(i);
          return peer.values.map((v, j) => {
            const r = (v / 100) * MAX_R;
            const a = angle + (jitter(i * 97 + j) - 0.5) * wedge;
            const p = point(a, r);
            return <circle key={j} cx={p.x} cy={p.y} r={2} fill="var(--muted)" opacity={0.35} />;
          });
        })}

        {series.map((s) => {
          const pts = s.values.map((v, i) => point(axisAngle(i), (v.value / 100) * MAX_R));
          const path = pts.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={s.name}>
              <polygon points={path} fill={s.color} fillOpacity={0.18} stroke={s.color} strokeWidth={2} />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={s.color}>
                  <title>
                    {s.name} · {metrics[i]}: percentil {Math.round(s.values[i].value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        {metrics.map((label, i) => {
          const p = point(axisAngle(i), MAX_R + 16);
          const anchor = Math.abs(p.x - CENTER) < 4 ? "middle" : p.x > CENTER ? "start" : "end";
          return (
            <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fill="var(--muted)" fontSize={11}>
              {label}
            </text>
          );
        })}
      </svg>

      {series.length > 1 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted text-center max-w-sm">
        Los puntos grises son el resto de jugadores de la misma posición (percentil por métrica).
      </p>
    </div>
  );
}
