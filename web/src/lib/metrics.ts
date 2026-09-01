import type { PlayerSeasonStats, PositionGroup } from "./types";

export type MetricDef = {
  key: string;
  label: string;
  short: string;
  format?: "pct" | "int" | "dec";
};

// Campos "core" que viven como columnas propias en player_season_stats,
// el resto de las métricas vive dentro de `stats` (jsonb).
const CORE_FIELDS = new Set([
  "matches_played",
  "starts",
  "minutes_played",
  "nineties",
  "goals",
  "assists",
  "yellow_cards",
  "red_cards",
]);

export function getStat(stats: PlayerSeasonStats | null | undefined, key: string): number | null {
  if (!stats) return null;
  if (CORE_FIELDS.has(key)) {
    const v = (stats as unknown as Record<string, unknown>)[key];
    return typeof v === "number" ? v : null;
  }
  const v = stats.stats?.[key];
  return typeof v === "number" ? v : null;
}

export function formatMetric(value: number | null, format?: MetricDef["format"]): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "pct") return `${value.toFixed(1)}%`;
  if (format === "int") return Math.round(value).toString();
  return value.toFixed(2);
}

export const POSITION_LABELS: Record<PositionGroup, string> = {
  GK: "Arquero",
  DEF: "Defensor",
  MID: "Mediocampista",
  FWD: "Delantero",
};

export const POSITION_COLORS: Record<PositionGroup, string> = {
  GK: "#facc15",
  DEF: "#38bdf8",
  MID: "#4ade80",
  FWD: "#fb923c",
};

// KPIs resumen para las tarjetas del perfil, por grupo posicional.
export const KPI_METRICS: Record<PositionGroup, MetricDef[]> = {
  FWD: [
    { key: "goals", label: "Goles", short: "Gol", format: "int" },
    { key: "assists", label: "Asistencias", short: "Ast", format: "int" },
    { key: "goles_p90", label: "Goles cada 90'", short: "Gol/90", format: "dec" },
    { key: "pct_tiros_al_arco", label: "% Tiros al arco", short: "%TA", format: "pct" },
  ],
  MID: [
    { key: "goals", label: "Goles", short: "Gol", format: "int" },
    { key: "assists", label: "Asistencias", short: "Ast", format: "int" },
    { key: "entradas_p90", label: "Entradas cada 90'", short: "Ent/90", format: "dec" },
    { key: "intercepciones_p90", label: "Intercepciones cada 90'", short: "Int/90", format: "dec" },
  ],
  DEF: [
    { key: "entradas_p90", label: "Entradas cada 90'", short: "Ent/90", format: "dec" },
    { key: "intercepciones_p90", label: "Intercepciones cada 90'", short: "Int/90", format: "dec" },
    { key: "faltas_p90", label: "Faltas cada 90'", short: "Flt/90", format: "dec" },
    { key: "goals", label: "Goles", short: "Gol", format: "int" },
  ],
  GK: [
    { key: "pct_atajadas", label: "% Atajadas", short: "%Ataj", format: "pct" },
    { key: "goles_recibidos_p90", label: "Goles recibidos cada 90'", short: "GR/90", format: "dec" },
    { key: "pct_vallas_invictas", label: "% Vallas invictas", short: "%VI", format: "pct" },
    { key: "penales_atajados", label: "Penales atajados", short: "PenAt", format: "int" },
  ],
};

// Métricas para el radar de percentiles, por grupo posicional.
export const RADAR_METRICS: Record<PositionGroup, MetricDef[]> = {
  FWD: [
    { key: "goles_p90", label: "Goles/90", short: "Gol" },
    { key: "asistencias_p90", label: "Asistencias/90", short: "Ast" },
    { key: "tiros_p90", label: "Tiros/90", short: "Tiros" },
    { key: "pct_tiros_al_arco", label: "% al arco", short: "%Arco", format: "pct" },
    { key: "goles_por_tiro", label: "Goles por tiro", short: "G/T" },
    { key: "centros_p90", label: "Centros/90", short: "Ctr" },
  ],
  MID: [
    { key: "goles_p90", label: "Goles/90", short: "Gol" },
    { key: "asistencias_p90", label: "Asistencias/90", short: "Ast" },
    { key: "tiros_p90", label: "Tiros/90", short: "Tiros" },
    { key: "intercepciones_p90", label: "Intercepciones/90", short: "Int" },
    { key: "entradas_p90", label: "Entradas/90", short: "Ent" },
    { key: "centros_p90", label: "Centros/90", short: "Ctr" },
  ],
  DEF: [
    { key: "intercepciones_p90", label: "Intercepciones/90", short: "Int" },
    { key: "entradas_p90", label: "Entradas/90", short: "Ent" },
    { key: "centros_p90", label: "Centros/90", short: "Ctr" },
    { key: "faltas_p90", label: "Faltas/90 (inv.)", short: "Flt" },
    { key: "goles_p90", label: "Goles/90", short: "Gol" },
    { key: "asistencias_p90", label: "Asistencias/90", short: "Ast" },
  ],
  GK: [
    { key: "pct_atajadas", label: "% Atajadas", short: "%Ataj", format: "pct" },
    { key: "pct_vallas_invictas", label: "% Vallas invictas", short: "%VI", format: "pct" },
    { key: "goles_recibidos_p90", label: "Goles recibidos/90 (inv.)", short: "GR" },
    { key: "penales_atajados", label: "Penales atajados", short: "PenAt" },
  ],
};

// Métricas para las que un valor más bajo es mejor (se invierte el percentil).
export const LOWER_IS_BETTER = new Set(["faltas_p90", "goles_recibidos_p90", "faltas_cometidas", "goles_recibidos"]);

export type MetricGroup = { category: string; metrics: MetricDef[] };

// Reporte de percentiles: mismas métricas del radar + varias más, agrupadas
// por categoría (estilo "scouting report" de barras horizontales).
export const PERCENTILE_GROUPS: Record<PositionGroup, MetricGroup[]> = {
  FWD: [
    {
      category: "Finalización",
      metrics: [
        { key: "goles_p90", label: "Goles cada 90'", short: "Gol/90" },
        { key: "goles_sin_penal", label: "Goles sin penal", short: "G sin pen", format: "int" },
        { key: "tiros_p90", label: "Tiros cada 90'", short: "Tiros/90" },
        { key: "pct_tiros_al_arco", label: "% de tiros al arco", short: "%Arco", format: "pct" },
        { key: "goles_por_tiro", label: "Goles por tiro", short: "G/Tiro" },
      ],
    },
    {
      category: "Creación",
      metrics: [
        { key: "asistencias_p90", label: "Asistencias cada 90'", short: "Ast/90" },
        { key: "centros_p90", label: "Centros cada 90'", short: "Ctr/90" },
        { key: "faltas_recibidas", label: "Faltas recibidas", short: "Flt rec", format: "int" },
      ],
    },
    {
      category: "Disciplina",
      metrics: [{ key: "faltas_p90", label: "Faltas cada 90' (invertido)", short: "Flt/90" }],
    },
  ],
  MID: [
    {
      category: "Creación",
      metrics: [
        { key: "asistencias_p90", label: "Asistencias cada 90'", short: "Ast/90" },
        { key: "centros_p90", label: "Centros cada 90'", short: "Ctr/90" },
        { key: "faltas_recibidas", label: "Faltas recibidas", short: "Flt rec", format: "int" },
      ],
    },
    {
      category: "Ataque",
      metrics: [
        { key: "goles_p90", label: "Goles cada 90'", short: "Gol/90" },
        { key: "tiros_p90", label: "Tiros cada 90'", short: "Tiros/90" },
      ],
    },
    {
      category: "Defensa",
      metrics: [
        { key: "intercepciones_p90", label: "Intercepciones cada 90'", short: "Int/90" },
        { key: "entradas_p90", label: "Entradas cada 90'", short: "Ent/90" },
      ],
    },
    {
      category: "Disciplina",
      metrics: [{ key: "faltas_p90", label: "Faltas cada 90' (invertido)", short: "Flt/90" }],
    },
  ],
  DEF: [
    {
      category: "Defensa",
      metrics: [
        { key: "intercepciones_p90", label: "Intercepciones cada 90'", short: "Int/90" },
        { key: "entradas_p90", label: "Entradas cada 90'", short: "Ent/90" },
      ],
    },
    {
      category: "Aporte ofensivo",
      metrics: [
        { key: "goles_p90", label: "Goles cada 90'", short: "Gol/90" },
        { key: "asistencias_p90", label: "Asistencias cada 90'", short: "Ast/90" },
        { key: "centros_p90", label: "Centros cada 90'", short: "Ctr/90" },
      ],
    },
    {
      category: "Disciplina",
      metrics: [{ key: "faltas_p90", label: "Faltas cada 90' (invertido)", short: "Flt/90" }],
    },
  ],
  GK: [
    {
      category: "Paradas",
      metrics: [
        { key: "pct_atajadas", label: "% de atajadas", short: "%Ataj", format: "pct" },
        { key: "goles_recibidos_p90", label: "Goles recibidos/90 (invertido)", short: "GR/90" },
        { key: "pct_vallas_invictas", label: "% de vallas invictas", short: "%VI", format: "pct" },
      ],
    },
    {
      category: "Penales",
      metrics: [{ key: "penales_atajados", label: "Penales atajados", short: "PenAt", format: "int" }],
    },
  ],
};
