"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export type RadarSeries = {
  name: string;
  color: string;
  values: { metric: string; value: number }[];
};

export default function PlayerRadar({ series }: { series: RadarSeries[] }) {
  if (series.length === 0 || series[0].values.length === 0) {
    return <div className="text-muted text-sm">Sin métricas suficientes para el radar.</div>;
  }

  const metrics = series[0].values.map((v) => v.metric);
  const data = metrics.map((metric, i) => {
    const row: Record<string, string | number> = { metric };
    series.forEach((s) => {
      row[s.name] = s.values[i]?.value ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} />
        {series.map((s) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
        ))}
        <Tooltip
          contentStyle={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`Percentil ${Math.round(Number(value))}`, undefined]}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />}
      </RadarChart>
    </ResponsiveContainer>
  );
}
