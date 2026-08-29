// Genera archivos .sql (uno por chunk) que llaman a admin_import_players,
// para ejecutarlos vía el MCP de Supabase (execute_sql) cuando no hay
// egress de red directo desde este entorno hacia *.supabase.co.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [, , csvPathArg, seasonArg, outDirArg] = process.argv;
const csvPath = resolve(csvPathArg);
const season = seasonArg ?? "2026";
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

const CORE_MAP = {
  player: "full_name",
  nacionalidad: "nationality",
  position: "position",
  equipo: "team",
  partidos_jugados: "matches_played",
  titular: "starts",
  minutes_played: "minutes_played",
  noventas_jugados: "nineties",
  goles: "goals",
  asistencias: "assists",
  amarillas: "yellow_cards",
  rojas: "red_cards",
};
const SKIP_FROM_STATS = new Set(Object.keys(CORE_MAP));

function parseEsNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inferPositionGroup(pos) {
  const p = String(pos ?? "").toUpperCase();
  if (p.includes("GK")) return "GK";
  if (p.startsWith("FW") || p.endsWith("FW")) return "FWD";
  if (p.startsWith("DF") || p.endsWith("DF")) return "DEF";
  if (p.includes("MF")) return "MID";
  return "MID";
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

function toPayloadRow(row) {
  const out = { stats: {} };
  for (const [csvCol, field] of Object.entries(CORE_MAP)) {
    out[field] = row[csvCol] ?? null;
  }
  out.position_group = inferPositionGroup(row.position);

  if (row.edad) {
    const years = parseInt(String(row.edad).split("-")[0], 10);
    if (Number.isFinite(years)) out.stats.edad = years;
  }
  if (row.nacimiento) {
    const year = Math.trunc(parseEsNumber(row.nacimiento) ?? NaN);
    if (Number.isFinite(year)) out.stats.anio_nacimiento = year;
  }

  for (const [col, raw] of Object.entries(row)) {
    if (SKIP_FROM_STATS.has(col) || col === "edad" || col === "nacimiento") continue;
    const n = parseEsNumber(raw);
    if (n !== null) out.stats[col] = n;
  }

  out.nineties = parseEsNumber(out.nineties);
  for (const numField of ["matches_played", "starts", "minutes_played", "goals", "assists", "yellow_cards", "red_cards"]) {
    if (out[numField] === "" || out[numField] === undefined) out[numField] = null;
  }
  return out;
}

const csv = readFileSync(csvPath, "utf8");
const rows = parseCsv(csv).filter((r) => r.player && r.player.trim() !== "");
const payload = rows.map(toPayloadRow);

const CHUNK = 40;
let n = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const json = JSON.stringify(chunk).replace(/\$\$/g, "$ $"); // evitar colisión con dollar-quoting
  const passcode = process.env.ADMIN_PASSCODE ?? "scouting-lpf-2026";
  const sql = `select admin_import_players('${passcode}', '${season}', $json$${json}$json$::jsonb);`;
  const file = resolve(outDir, `chunk_${String(n).padStart(3, "0")}.sql`);
  writeFileSync(file, sql, "utf8");
  n++;
}
console.log(`Generados ${n} archivos .sql en ${outDir} (${payload.length} filas totales).`);
