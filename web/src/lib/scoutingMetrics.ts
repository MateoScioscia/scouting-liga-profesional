import type { ScoutingMatchStat } from "./types";

function sum(rows: ScoutingMatchStat[], key: keyof ScoutingMatchStat): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function pct(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

function opponentLabel(r: ScoutingMatchStat): string {
  return r.opponent.replace(/^Vs\s+/i, "");
}

export type ScoutingSummary = {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  gaPer90: number;
  xgTotal: number;
  actionsPct: number;
  actionsSuccessful: number;
  actionsTotal: number;
  passesPct: number;
  passesAccurate: number;
  passes: number;
  possessionBalance: number;
  recoveries: number;
  losses: number;
  pressingPer90: number;
  pressingTotal: number;
  interceptions: number;
  recoveriesOppHalf: number;
};

export function computeSummary(rows: ScoutingMatchStat[]): ScoutingSummary {
  const minutes = sum(rows, "minutes_played");
  const goals = sum(rows, "goals");
  const assists = sum(rows, "assists");
  const nineties = minutes / 90;
  const interceptions = sum(rows, "interceptions");
  const recoveriesOppHalf = sum(rows, "recoveries_opp_half");
  const recoveries = sum(rows, "recoveries");
  const losses = sum(rows, "losses");
  const actionsTotal = sum(rows, "actions_total");
  const actionsSuccessful = sum(rows, "actions_successful");
  const passes = sum(rows, "passes");
  const passesAccurate = sum(rows, "passes_accurate");

  return {
    matches: rows.length,
    minutes,
    goals,
    assists,
    gaPer90: nineties > 0 ? (goals + assists) / nineties : 0,
    xgTotal: sum(rows, "xg"),
    actionsPct: pct(actionsSuccessful, actionsTotal),
    actionsSuccessful,
    actionsTotal,
    passesPct: pct(passesAccurate, passes),
    passesAccurate,
    passes,
    possessionBalance: recoveries - losses,
    recoveries,
    losses,
    pressingPer90: nineties > 0 ? (interceptions + recoveriesOppHalf) / nineties : 0,
    pressingTotal: interceptions + recoveriesOppHalf,
    interceptions,
    recoveriesOppHalf,
  };
}

export function computeProfileBars(rows: ScoutingMatchStat[]): { label: string; value: number }[] {
  const dribbles = sum(rows, "dribbles");
  const dribblesOk = sum(rows, "dribbles_successful");
  const passes = sum(rows, "passes");
  const passesOk = sum(rows, "passes_accurate");
  const shots = sum(rows, "shots");
  const goals = sum(rows, "goals");
  const duels = sum(rows, "duels");
  const duelsOk = sum(rows, "duels_won");
  const actionsTotal = sum(rows, "actions_total");
  const actionsOk = sum(rows, "actions_successful");
  const aerial = sum(rows, "aerial_duels");
  const aerialOk = sum(rows, "aerial_duels_won");

  return [
    { label: "% Regates con éxito", value: pct(dribblesOk, dribbles) },
    { label: "% Pases logrados", value: pct(passesOk, passes) },
    { label: "% Eficacia de finalización", value: pct(goals, shots) },
    { label: "% Duelos ganados", value: pct(duelsOk, duels) },
    { label: "% Acciones con éxito", value: pct(actionsOk, actionsTotal) },
    { label: "% Duelos aéreos", value: pct(aerialOk, aerial) },
  ];
}

export function computeVolumeEfficiency(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    "Acciones totales": r.actions_total,
    "% Acciones con éxito": Math.round(pct(r.actions_successful, r.actions_total) * 10) / 10,
  }));
}

export type OffensiveKpis = {
  gaPer90: number;
  xgTotal: number;
  shotsPerMatch: number;
  penaltyTouchesPerMatch: number;
  dribblesPct: number;
};

export function computeOffensiveKpis(rows: ScoutingMatchStat[]): OffensiveKpis {
  const matches = rows.length || 1;
  const minutes = sum(rows, "minutes_played");
  const nineties = minutes / 90;
  const goals = sum(rows, "goals");
  const assists = sum(rows, "assists");
  return {
    gaPer90: nineties > 0 ? (goals + assists) / nineties : 0,
    xgTotal: sum(rows, "xg"),
    shotsPerMatch: sum(rows, "shots") / matches,
    penaltyTouchesPerMatch: sum(rows, "penalty_area_touches") / matches,
    dribblesPct: pct(sum(rows, "dribbles_successful"), sum(rows, "dribbles")),
  };
}

export function perMatchActionsBreakdown(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    Logradas: r.actions_successful,
    Falladas: Math.max(0, r.actions_total - r.actions_successful),
  }));
}

export function perMatchShots(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({ label: opponentLabel(r), Tiros: r.shots, "Tiros logrados": r.shots_on_target }));
}

export function cumulativeXgGoals(rows: ScoutingMatchStat[]) {
  let xg = 0;
  let goals = 0;
  return rows.map((r) => {
    xg += r.xg;
    goals += r.goals;
    return { label: opponentLabel(r), xG: Math.round(xg * 100) / 100, Goles: goals };
  });
}

export function duelsPctBars(rows: ScoutingMatchStat[]): { label: string; value: number }[] {
  const duels = sum(rows, "duels");
  const duelsOk = sum(rows, "duels_won");
  const off = sum(rows, "offensive_duels");
  const offOk = sum(rows, "offensive_duels_won");
  const aer = sum(rows, "aerial_duels");
  const aerOk = sum(rows, "aerial_duels_won");
  return [
    { label: "% Duelos generales", value: pct(duelsOk, duels) },
    { label: "% Duelos ofensivos", value: pct(offOk, off) },
    { label: "% Duelos aéreos", value: pct(aerOk, aer) },
  ];
}

export type BuildupKpis = {
  passesPct: number;
  longPassesPct: number;
  finalThirdPct: number;
  forwardPassesPct: number;
  penaltyAreaPassesPct: number;
  backPassesPct: number;
};

export function computeBuildupKpis(rows: ScoutingMatchStat[]): BuildupKpis {
  return {
    passesPct: pct(sum(rows, "passes_accurate"), sum(rows, "passes")),
    longPassesPct: pct(sum(rows, "long_passes_accurate"), sum(rows, "long_passes")),
    finalThirdPct: pct(sum(rows, "passes_final_third_accurate"), sum(rows, "passes_final_third")),
    forwardPassesPct: pct(sum(rows, "forward_passes_accurate"), sum(rows, "forward_passes")),
    penaltyAreaPassesPct: pct(sum(rows, "passes_penalty_area_accurate"), sum(rows, "passes_penalty_area")),
    backPassesPct: pct(sum(rows, "back_passes_accurate"), sum(rows, "back_passes")),
  };
}

export function perMatchPassPct(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({ label: opponentLabel(r), "% Pases logrados": Math.round(pct(r.passes_accurate, r.passes) * 10) / 10 }));
}

export function averagePassPct(rows: ScoutingMatchStat[]): number {
  return pct(sum(rows, "passes_accurate"), sum(rows, "passes"));
}

export function perMatchPossessionBalance(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({ label: opponentLabel(r), Balance: r.recoveries - r.losses }));
}

export function perMatchPassDirection(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    "Pases hacia atrás": r.back_passes,
    "Pases hacia adelante": r.forward_passes,
  }));
}

export function crossesLongPassesTotals(rows: ScoutingMatchStat[]): { label: string; value: number }[] {
  return [
    { label: "Centros", value: sum(rows, "crosses") },
    { label: "Centros precisos", value: sum(rows, "crosses_accurate") },
    { label: "Pases largos", value: sum(rows, "long_passes") },
    { label: "Pases largos logrados", value: sum(rows, "long_passes_accurate") },
  ];
}

export function perMatchDangerGeneration(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    "Pases en profundidad": r.deep_passes,
    "Pases en el último tercio": r.passes_final_third,
    Centros: r.crosses,
  }));
}

export type DefensiveKpis = {
  yellowCards: number;
  interceptions: number;
  recoveries: number;
  recoveriesOppHalf: number;
  duelsWonPerMatch: number;
};

export function computeDefensiveKpis(rows: ScoutingMatchStat[]): DefensiveKpis {
  const matches = rows.length || 1;
  return {
    yellowCards: sum(rows, "yellow_cards"),
    interceptions: sum(rows, "interceptions"),
    recoveries: sum(rows, "recoveries"),
    recoveriesOppHalf: sum(rows, "recoveries_opp_half"),
    duelsWonPerMatch: sum(rows, "duels_won") / matches,
  };
}

export function perMatchDuels(rows: ScoutingMatchStat[]) {
  return rows.map((r) => ({
    label: opponentLabel(r),
    Duelos: r.duels,
    "Duelos ofensivos": r.offensive_duels,
    "Duelos aéreos": r.aerial_duels,
  }));
}

export function defensiveActionsTotals(rows: ScoutingMatchStat[]): { label: string; value: number }[] {
  return [
    { label: "Balones recuperados", value: sum(rows, "recoveries") },
    { label: "Balones recuperados mitad adv.", value: sum(rows, "recoveries_opp_half") },
    { label: "Interceptaciones", value: sum(rows, "interceptions") },
  ];
}
