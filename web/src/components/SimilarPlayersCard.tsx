import Link from "next/link";
import type { SimilarPlayer } from "@/lib/similarity";

export default function SimilarPlayersCard({ players }: { players: SimilarPlayer[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium mb-1">Perfiles similares</h2>
      <p className="text-xs text-muted mb-4">
        Jugadores de la misma posición con un perfil estadístico parecido, calculado por distancia entre percentiles.
      </p>
      {players.length === 0 ? (
        <p className="text-sm text-muted">No hay suficientes jugadores comparables todavía.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/jugadores/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-accent/40 hover:bg-surface-2/60 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted truncate">{p.team ?? "Sin equipo"}</div>
              </div>
              <span className="text-sm font-semibold text-accent-2 tabular-nums shrink-0">{p.similarity}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
