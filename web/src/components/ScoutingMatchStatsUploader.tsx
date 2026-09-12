"use client";

import { useMemo, useState } from "react";
import { parseFile, parseEsNumber, type ParsedTable } from "@/lib/parseFile";
import { SCOUTING_MATCH_FIELDS, guessMapping } from "@/lib/fieldDefs";
import { getSupabase } from "@/lib/supabase";

const TEXT_FIELDS = new Set(["full_name", "opponent", "result_code", "score", "competition", "match_date", "position_specific"]);

export default function ScoutingMatchStatsUploader() {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [position, setPosition] = useState("");
  const [club, setClub] = useState("");
  const [league, setLeague] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, typeof SCOUTING_MATCH_FIELDS>();
    for (const f of SCOUTING_MATCH_FIELDS) {
      const g = f.group ?? "Otros";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, []);

  async function handleFile(file: File) {
    setStatus("idle");
    setMessage("");
    const parsed = await parseFile(file);
    setTable(parsed);
    const guessed = guessMapping(parsed.headers, SCOUTING_MATCH_FIELDS);
    setMapping(guessed);
    if (guessed["full_name"] && parsed.rows[0]) {
      setFullName(String(parsed.rows[0][guessed["full_name"]] ?? "").trim());
    }
    setStatus("ready");
  }

  function buildRows(): Record<string, string | number | null>[] {
    if (!table) return [];
    return table.rows
      .map((row) => {
        const out: Record<string, string | number | null> = {};
        for (const f of SCOUTING_MATCH_FIELDS) {
          if (f.key === "full_name") continue;
          const col = mapping[f.key];
          const raw = col ? row[col] : undefined;
          out[f.key] = TEXT_FIELDS.has(f.key) ? String(raw ?? "").trim() || null : parseEsNumber(raw);
        }
        return out;
      })
      .filter((r) => r["opponent"] && r["match_date"]);
  }

  async function handleSubmit() {
    if (!passcode) {
      setMessage("Ingresá el código de acceso.");
      setStatus("error");
      return;
    }
    if (!fullName.trim()) {
      setMessage("Falta el nombre del jugador.");
      setStatus("error");
      return;
    }
    const rows = buildRows();
    if (rows.length === 0) {
      setMessage("No hay filas válidas (revisá el mapeo: rival y fecha son obligatorios).");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setMessage("");
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc("admin_import_scouting_data", {
        passcode,
        player: {
          full_name: fullName.trim(),
          nationality: nationality.trim() || null,
          position: position.trim() || null,
          club: club.trim() || null,
          league: league.trim() || null,
          photo_url: photoUrl.trim() || null,
        },
        rows,
      });
      if (error) throw error;
      setStatus("done");
      setMessage(`Listo: se cargaron ${data?.inserted ?? rows.length} partidos para ${fullName.trim()}.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error desconocido al importar.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-medium mb-1">Archivo con estadísticas partido a partido (.csv, .xlsx)</label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#06170e] hover:file:bg-accent-2"
        />
        <p className="text-xs text-muted mt-1">
          Pensado para exports tipo Wyscout con una fila por partido. Sirve para jugadores de scouting externo (fuera
          del roster de la Liga Profesional), que se ven en una página de análisis aparte.
        </p>
      </div>

      {table && (
        <>
          <div>
            <h3 className="text-sm font-medium mb-2">Datos del jugador</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Nombre completo *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Nacionalidad</label>
                <input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Posición</label>
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Club</label>
                <input
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Liga</label>
                <input
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">URL de foto (opcional)</label>
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Mapeo de columnas ({table.rows.length} partidos detectados)</h3>
            <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
              {groups.map(([group, fields]) => (
                <div key={group}>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted mb-1.5">{group}</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {fields
                      .filter((f) => f.key !== "full_name")
                      .map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted truncate" title={f.label}>
                            {f.label}
                            {f.required && <span className="text-danger"> *</span>}
                          </span>
                          <select
                            value={mapping[f.key] ?? ""}
                            onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent max-w-[55%]"
                          >
                            <option value="">— sin mapear —</option>
                            {table.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Código de acceso</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-56 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={status === "submitting"}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-[#06170e] hover:bg-accent-2 transition-colors disabled:opacity-50"
            >
              {status === "submitting" ? "Importando…" : `Importar ${table.rows.length} partidos`}
            </button>
          </div>

          {message && <p className={status === "error" ? "text-danger text-sm" : "text-accent-2 text-sm"}>{message}</p>}
        </>
      )}
    </div>
  );
}
