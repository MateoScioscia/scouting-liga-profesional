import type { PlayerInsights } from "@/lib/insights";

export default function InsightsCard({ insights }: { insights: PlayerInsights }) {
  if (insights.strengths.length === 0 && insights.weaknesses.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-medium text-accent-2">Puntos fuertes</h2>
          <span className="text-xs rounded-full bg-accent/15 text-accent-2 px-2 py-0.5">
            {insights.strengths.length}
          </span>
        </div>
        {insights.strengths.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {insights.strengths.map((s) => (
              <li key={s} className="text-sm rounded-lg border-l-2 border-accent bg-accent/5 px-3 py-2">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin puntos destacados todavía.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-medium text-danger">Áreas de mejora</h2>
          <span className="text-xs rounded-full bg-danger/15 text-danger px-2 py-0.5">
            {insights.weaknesses.length}
          </span>
        </div>
        {insights.weaknesses.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {insights.weaknesses.map((s) => (
              <li key={s} className="text-sm rounded-lg border-l-2 border-danger bg-danger/5 px-3 py-2">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin debilidades marcadas.</p>
        )}
      </div>
    </div>
  );
}
