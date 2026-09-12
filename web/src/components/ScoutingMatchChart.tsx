"use client";

import {
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type BarDef = { key: string; color: string; stackId?: string };
type LineDef = { key: string; color: string; yAxisId?: "left" | "right"; dashed?: boolean };

export default function ScoutingMatchChart({
  data,
  bars = [],
  lines = [],
  dualAxis = false,
  height = 260,
  referenceValue,
  referenceLabel,
}: {
  data: Record<string, string | number>[];
  bars?: BarDef[];
  lines?: LineDef[];
  dualAxis?: boolean;
  height?: number;
  referenceValue?: number;
  referenceLabel?: string;
}) {
  if (data.length === 0) {
    return <div className="text-muted text-sm">Sin partidos cargados.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted)", fontSize: 10 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={50}
          interval={0}
        />
        <YAxis yAxisId="left" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        {dualAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
        )}
        <Tooltip
          contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        {(bars.length > 1 || lines.length > 1) && <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />}
        {referenceValue !== undefined && (
          <ReferenceLine
            yAxisId="left"
            y={referenceValue}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{ value: referenceLabel, position: "insideTopLeft", fill: "var(--muted)", fontSize: 10 }}
          />
        )}
        {bars.map((b) => (
          <Bar key={b.key} yAxisId="left" dataKey={b.key} fill={b.color} stackId={b.stackId} radius={b.stackId ? 0 : [3, 3, 0, 0]} />
        ))}
        {lines.map((l) => (
          <Line
            key={l.key}
            yAxisId={l.yAxisId ?? "left"}
            type="monotone"
            dataKey={l.key}
            stroke={l.color}
            strokeWidth={2}
            strokeDasharray={l.dashed ? "4 4" : undefined}
            dot={{ r: 3 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
