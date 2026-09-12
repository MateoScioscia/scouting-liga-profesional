import type { PlayerMatchStat } from "./types";

function sum(rows: PlayerMatchStat[], key: keyof PlayerMatchStat): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function pct(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

function opponentLabel(r: PlayerMatchStat): string {
  return r.opponent ?? "—";
}

export type MatchLogSummary = {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  gaPer90: number;
  xgTotal: number;
  xagTotal: number;
  passesPct: number;
  passesCompleted: number;
  passesAttempted: number;
  tackles: number;
  interceptions: number;
  progressivePasses: number;
  progressiveCarries: number;
};

export function computeSummary(rows: PlayerMatchStat[]): MatchLogSummary {
  const minutes = sum(rows, "minutes_played");
  const goals = sum(rows, "goals");
  const assists = sum(rows, "assists");
  const nineties = minutes / 90;
  const passesCompleted = sum(rows, "passes_completed");
  const passesAttempted = sum(rows, "passes_attempted");

  return {
    matches: rows.length,
    minutes,
    goals,
    assists,
    gaPer90: nineties > 0 ? (goals + assists) / nineties : 0,
    xgTotal: sum(rows, "xg"),
    xagTotal: sum(rows, "xag"),
    passesPct: pct(passesCompleted, passesAttempted),
    passesCompleted,
    passesAttempted,
    tackles: sum(rows, "tackles"),
    interceptions: sum(rows, "interceptions"),
    progressivePasses: sum(rows, "progressive_passes"),
    progressiveCarries: sum(rows, "progressive_carries"),
  };
}

export function cumulativeXgGoals(rows: PlayerMatchStat[]) {
  let xg = 0;
  let goals = 0;
  return rows.map((r) => {
    xg += r.xg;
    goals += r.goals;
    return { label: opponentLabel(r), xG: Math.round(xg * 100) / 100, Goles: goals };
  });
}

export function perMatchShots(rows: PlayerMatchStat[]) {
  return rows.map((r) => ({ label: opponentLabel(r), Tiros: r.shots, "Tiros al arco": r.shots_on_target }));
}

export function perMatchPassPct(rows: PlayerMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    "% Pases completados": Math.round(pct(r.passes_completed, r.passes_attempted) * 10) / 10,
  }));
}

export function averagePassPct(rows: PlayerMatchStat[]): number {
  return pct(sum(rows, "passes_completed"), sum(rows, "passes_attempted"));
}

export function perMatchProgression(rows: PlayerMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    "Pases progresivos": r.progressive_passes,
    "Conducciones progresivas": r.progressive_carries,
  }));
}

export function perMatchDefensiveActions(rows: PlayerMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    Tackles: r.tackles,
    Intercepciones: r.interceptions,
    Bloqueos: r.blocks,
  }));
}

export function creationTotals(rows: PlayerMatchStat[]): { label: string; value: number }[] {
  return [
    { label: "Acciones de tiro creadas (SCA)", value: sum(rows, "sca") },
    { label: "Acciones de gol creadas (GCA)", value: sum(rows, "gca") },
    { label: "Regates intentados", value: sum(rows, "take_ons_attempted") },
    { label: "Regates exitosos", value: sum(rows, "take_ons_successful") },
  ];
}
