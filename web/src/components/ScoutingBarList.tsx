export default function ScoutingBarList({
  items,
  color = "var(--accent)",
  mode = "percent",
}: {
  items: { label: string; value: number }[];
  color?: string;
  mode?: "percent" | "count";
}) {
  const max = mode === "count" ? Math.max(1, ...items.map((i) => i.value)) : 100;

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const widthPct = Math.min((item.value / max) * 100, 100);
        return (
          <div key={item.label} className="flex items-center gap-3 text-sm">
            <div className="w-44 shrink-0 text-muted truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(widthPct, item.value > 0 ? 2 : 0)}%`, background: color }}
              />
            </div>
            <div className="w-14 shrink-0 text-right tabular-nums">
              {mode === "percent" ? `${item.value.toFixed(2).replace(".", ",")}%` : item.value.toLocaleString("es-AR")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
