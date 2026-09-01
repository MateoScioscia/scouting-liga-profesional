import type { ShotQualityProxy } from "@/lib/xgProxy";

export default function ShotQualityCard({ proxy }: { proxy: ShotQualityProxy }) {
  const overperforming = proxy.diff >= 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium mb-1">Definición vs. esperado (estimado)</h2>
      <p className="text-xs text-muted mb-4">
        Estimación simplificada: compara los goles reales contra los que convertiría un jugador promedio de la
        misma posición con la misma cantidad de tiros al arco. No usa la ubicación real de cada disparo, así que{" "}
        <strong>no es un xG real</strong> — es una referencia de sobre/bajo rendimiento.
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{proxy.goals}</div>
          <div className="text-xs text-muted mt-1">Goles (sin penal)</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{proxy.expectedGoals.toFixed(1)}</div>
          <div className="text-xs text-muted mt-1">Esperado (estimado)</div>
        </div>
        <div>
          <div className={`text-2xl font-semibold tabular-nums ${overperforming ? "text-accent" : "text-danger"}`}>
            {overperforming ? "+" : ""}
            {proxy.diff.toFixed(1)}
          </div>
          <div className="text-xs text-muted mt-1">Diferencia</div>
        </div>
      </div>
      <p className="text-xs text-muted mt-4">
        Basado en {proxy.shotsOnTarget} tiros al arco y una conversión promedio del pool de{" "}
        {(proxy.leagueConversionRate * 100).toFixed(1)}% por tiro al arco.
      </p>
    </div>
  );
}
