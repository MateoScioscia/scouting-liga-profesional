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

// Muestra el contrato restante en meses si falta menos de un año (mas
// preciso que redondear a "0 años"), y en años enteros si falta mas.
export function formatContractRemaining(contractUntil: string | null): string {
  if (!contractUntil) return "—";
  const diffMs = new Date(contractUntil).getTime() - Date.now();
  if (diffMs <= 0) return "Vencido";
  const totalMonths = diffMs / (1000 * 3600 * 24 * 30.44);
  if (totalMonths < 12) {
    return `${Math.max(1, Math.round(totalMonths))} meses`;
  }
  return `${Math.round(totalMonths / 12)} años`;
}

export function percentile(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 0;
  let below = 0;
  for (const v of sortedAsc) {
    if (v <= value) below++;
  }
  return Math.round((below / sortedAsc.length) * 100);
}
