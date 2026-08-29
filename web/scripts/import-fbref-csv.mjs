// Importa el CSV de FBref (Liga Profesional Argentina) a Supabase usando la
// función RPC admin_import_players, exactamente el mismo camino que usa la
// página de carga de datos de la app. Uso:
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... \
//   node scripts/import-fbref-csv.mjs ../fbref_liga_profesional_master.csv 2026
//
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , csvPathArg, seasonArg] = process.argv;
const csvPath = resolve(csvPathArg ?? "../fbref_liga_profesional_master.csv");
const season = seasonArg ?? "2026";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_PASSCODE) {
  console.error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY / ADMIN_PASSCODE en el entorno.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// columnas que van a campos explícitos de la tabla; el resto (numéricas) van a `stats` jsonb
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

  // edad viene como "26-015" (años-días FBref); nos quedamos con los años.
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

  // limpiar campos vacíos que romperían casts numéricos en la función SQL
  for (const numField of ["matches_played", "starts", "minutes_played", "nineties", "goals", "assists", "yellow_cards", "red_cards"]) {
    if (out[numField] === "" || out[numField] === undefined) out[numField] = null;
  }
  return out;
}

async function main() {
  const csv = readFileSync(csvPath, "utf8");
  const rows = parseCsv(csv).filter((r) => r.player && r.player.trim() !== "");
  console.log(`Filas a importar: ${rows.length}`);

  const payload = rows.map(toPayloadRow);
  const CHUNK = 150;
  let totalInserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("admin_import_players", {
      passcode: ADMIN_PASSCODE,
      season,
      rows: chunk,
    });
    if (error) {
      console.error(`Error en chunk ${i}-${i + chunk.length}:`, error.message);
      process.exit(1);
    }
    totalInserted += data?.inserted ?? 0;
    console.log(`Importadas ${Math.min(i + CHUNK, payload.length)}/${payload.length}`);
  }
  console.log(`Listo. Filas procesadas: ${totalInserted}`);
}

main();
