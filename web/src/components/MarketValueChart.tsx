"use client";

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MarketValue } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";

export default function MarketValueChart({ values }: { values: MarketValue[] }) {
  if (values.length === 0) {
    return <div className="text-muted text-sm">Todavía no hay historial de valor de mercado cargado.</div>;
  }

  const data = values.map((v) => ({
    date: v.value_date,
    label: formatDate(v.value_date),
    value: v.value_amount,
    currency: v.currency,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatCurrency(v, data[0]?.currency)}
          width={70}
        />
        <Tooltip
          contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value, _name, item) => [formatCurrency(Number(value), item.payload.currency), "Valor"]}
        />
        <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
