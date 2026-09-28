"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { PlayerInjury } from "@/lib/types";
import { formatDate } from "@/lib/format";
import KpiCard from "./KpiCard";

const STORAGE_KEY = "codigo-acceso";
const DAY = 24 * 3600 * 1000;

function readStoredCode(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function daysOut(i: PlayerInjury): number {
  const end = i.return_date ? new Date(i.return_date).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(i.injury_date).getTime()) / DAY));
}

// Días de baja dentro de los últimos 365 días, para la disponibilidad.
function daysOutLastYear(list: PlayerInjury[]): number {
  const from = Date.now() - 365 * DAY;
  return list.reduce((acc, i) => {
    const start = Math.max(new Date(i.injury_date).getTime(), from);
    const end = i.return_date ? new Date(i.return_date).getTime() : Date.now();
    return acc + Math.max(0, (end - start) / DAY);
  }, 0);
}

async function fetchInjuries(passcode: string, playerId: string): Promise<{ data: PlayerInjury[]; error: string | null }> {
  const { data, error } = await getSupabase().rpc("get_player_injuries", { passcode, p_player_id: playerId });
  return { data: (data ?? []) as PlayerInjury[], error: error ? error.message : null };
}

// Las lesiones son datos de salud: se leen con el código de acceso a través de
// la RPC get_player_injuries (la tabla no es legible con la clave pública).
export default function InjuriesCard({ playerId }: { playerId: string }) {
  const [code, setCode] = useState("");
  const [injuries, setInjuries] = useState<PlayerInjury[] | null>(null);
  const [status, setStatus] = useState<"locked" | "loading" | "ready" | "error">("locked");
  const [message, setMessage] = useState("");

  const apply = useCallback((passcode: string, result: Awaited<ReturnType<typeof fetchInjuries>>) => {
    if (result.error) {
      setStatus("error");
      setMessage(result.error.includes("invalid passcode") ? "Código de acceso incorrecto." : result.error);
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, passcode);
    } catch {
      // sin almacenamiento de sesión: se vuelve a pedir el código la próxima vez
    }
    setInjuries(result.data);
    setStatus("ready");
  }, []);

  async function load(passcode: string) {
    setStatus("loading");
    setMessage("");
    apply(passcode, await fetchInjuries(passcode, playerId));
  }

  // si ya se ingresó el código en esta sesión, se cargan las lesiones solas
  useEffect(() => {
    const stored = readStoredCode();
    if (!stored) return;
    let cancelled = false;
    fetchInjuries(stored, playerId).then((result) => {
      if (!cancelled) apply(stored, result);
    });
    return () => {
      cancelled = true;
    };
  }, [playerId, apply]);

  const active = injuries?.find((i) => !i.return_date);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Historial de lesiones</h2>
        <span className="text-xs text-muted">Datos de salud: se ven solo con el código de acceso</span>
      </div>

      {status !== "ready" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code) void load(code);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label htmlFor="codigo-lesiones" className="block text-sm font-medium mb-1">
              Código de acceso
            </label>
            <input
              id="codigo-lesiones"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-56 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={!code || status === "loading"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#06170e] hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Cargando…" : "Ver lesiones"}
          </button>
          {message && <p className="text-danger text-sm w-full">{message}</p>}
        </form>
      )}

      {status === "ready" && injuries && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Estado" value={active ? "Lesionado" : "Disponible"} hint={active?.expected_return_date ? `Alta estimada: ${formatDate(active.expected_return_date)}` : undefined} />
            <KpiCard label="Lesiones" value={String(injuries.length)} hint="registradas" />
            <KpiCard label="Disponibilidad" value={`${Math.round((1 - daysOutLastYear(injuries) / 365) * 100)}%`} hint="últimos 365 días" />
            <KpiCard label="Recidivas" value={String(injuries.filter((i) => i.is_recurrence).length)} hint="misma zona y lado" />
          </div>

          {injuries.length === 0 ? (
            <p className="text-sm text-muted">Sin lesiones registradas.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="text-sm min-w-full tabular-nums">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-2 pr-4 font-medium">Inicio</th>
                    <th className="py-2 px-3 font-medium">Alta</th>
                    <th className="py-2 px-3 font-medium">Días</th>
                    <th className="py-2 px-3 font-medium">Tipo</th>
                    <th className="py-2 px-3 font-medium">Zona</th>
                    <th className="py-2 px-3 font-medium">Lado</th>
                    <th className="py-2 px-3 font-medium">Ocurrió en</th>
                    <th className="py-2 px-3 font-medium">Recidiva</th>
                  </tr>
                </thead>
                <tbody>
                  {injuries.map((i) => (
                    <tr key={i.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">{formatDate(i.injury_date)}</td>
                      <td className="py-2 px-3">
                        {i.return_date ? (
                          formatDate(i.return_date)
                        ) : (
                          <span className="text-danger">
                            de baja{i.expected_return_date ? ` · est. ${formatDate(i.expected_return_date)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">{daysOut(i)}</td>
                      <td className="py-2 px-3">{i.injury_type}</td>
                      <td className="py-2 px-3">{i.body_part}</td>
                      <td className="py-2 px-3">{i.body_side ?? "—"}</td>
                      <td className="py-2 px-3">{i.occurred_in}</td>
                      <td className="py-2 px-3">{i.is_recurrence ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
