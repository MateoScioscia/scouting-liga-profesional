import Link from "next/link";
import { getScoutingPlayers } from "@/lib/queries";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function ScoutingPage() {
  const players = await getScoutingPlayers();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scouting externo</h1>
        <p className="text-muted mt-1">
          Jugadores de otras ligas evaluados con reportes partido a partido — no forman parte del roster de la Liga
          Profesional. Se cargan desde{" "}
          <Link href="/cargar-datos" className="text-accent-2 hover:underline">
            Cargar datos
          </Link>
          .
        </p>
      </div>

      {players.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
          Todavía no hay jugadores de scouting cargados.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/scouting/${p.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-accent/50 transition-colors"
            >
              <Avatar src={p.photo_url} name={p.full_name} color="var(--accent)" size={48} />
              <div className="min-w-0">
                <div className="font-medium truncate">{p.full_name}</div>
                <div className="text-xs text-muted truncate">
                  {p.position ? `${p.position} — ` : ""}
                  {p.league ?? p.nationality ?? ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
