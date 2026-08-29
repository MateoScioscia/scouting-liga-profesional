export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: amount >= 1_000_000 ? "compact" : "standard",
  }).format(amount);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { year: "numeric", month: "short", day: "numeric" });
}

export function percentile(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 0;
  let below = 0;
  for (const v of sortedAsc) {
    if (v <= value) below++;
  }
  return Math.round((below / sortedAsc.length) * 100);
}
