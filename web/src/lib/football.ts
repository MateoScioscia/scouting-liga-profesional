export function inferPositionGroup(pos: string | undefined | null): "GK" | "DEF" | "MID" | "FWD" {
  const p = String(pos ?? "").toUpperCase();
  if (p.includes("GK")) return "GK";
  if (p.startsWith("FW") || p.endsWith("FW")) return "FWD";
  if (p.startsWith("DF") || p.endsWith("DF")) return "DEF";
  if (p.includes("MF")) return "MID";
  return "MID";
}
