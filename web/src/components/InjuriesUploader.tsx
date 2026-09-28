"use client";

import { useState } from "react";
import { parseFile, type ParsedTable } from "@/lib/parseFile";
import { INJURY_FIELDS, guessMapping } from "@/lib/fieldDefs";
import { getSupabase } from "@/lib/supabase";

const CHUNK_SIZE = 150;

type InjuryRow = Record<(typeof INJURY_FIELDS)[number]["key"], string>;

// Acepta fechas AAAA-MM-DD o DD/MM/AAAA (formato habitual en Excel en español).
function normalizeDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return s;
}

const DATE_KEYS = new Set(["injury_date", "expected_return_date", "return_date"]);

export default function InjuriesUploader() {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [notFound, setNotFound] = useState<string[]>([]);

  async function handleFile(file: File) {
    setStatus("idle");
    setMessage("");
    setNotFound([]);
    const parsed = await parseFile(file);
    setTable(parsed);
    setMapping(guessMapping(parsed.headers, INJURY_FIELDS));
    setStatus("ready");
  }

  function buildRows(): InjuryRow[] {
    if (!table) return [];
    return table.rows
      .map((row) => {
        const out: Record<string, string> = {};
        for (const f of INJURY_FIELDS) {
          const raw = row[mapping[f.key]];
          out[f.key] = DATE_KEYS.has(f.key) ? normalizeDate(raw) : String(raw ?? "").trim();
        }
        return out as InjuryRow;
      })
      .filter((r) => r.full_name && r.injury_date && r.injury_type && r.body_part);
  }

  async function handleSubmit() {
    if (!passcode) {
      setMessage("Ingresá el código de acceso.");
      setStatus("error");
      return;
    }
    const rows = buildRows();
    if (rows.length === 0) {
      setMessage("No hay filas válidas (jugador, fecha, tipo y zona son obligatorios).");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setMessage("");
    const supabase = getSupabase();
    let inserted = 0;
    const missing: string[] = [];
    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const { data, error } = await supabase.rpc("admin_import_injuries", { passcode, rows: rows.slice(i, i + CHUNK_SIZE) });
        if (error) throw error;
        inserted += data?.inserted ?? 0;
        missing.push(...((data?.not_found as string[] | undefined) ?? []));
      }
      setNotFound(Array.from(new Set(missing)));
      setStatus("done");
      setMessage(`Listo: se cargaron ${inserted} lesiones.`);
    } catch (err) {
      setStatus("error");
      const text = err instanceof Error ? err.message : "Error desconocido al importar.";
      setMessage(text.includes("invalid passcode") ? "Código de acceso incorrecto." : text);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="archivo-lesiones" className="block text-sm font-medium mb-1">
          Archivo (.csv, .xlsx)
        </label>
        <input
          id="archivo-lesiones"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#06170e] hover:file:bg-accent-2"
        />
        <p className="text-xs text-muted mt-1">
          Una fila por lesión. El jugador tiene que existir en la base (se busca por nombre). Si no indicás si es
          recidiva, se calcula sola: misma zona y lado en menos de 2 años. Las lesiones son datos de salud y solo se ven
          con el código de acceso.
        </p>
      </div>

      {table && (
        <>
          <div>
            <h3 className="text-sm font-medium mb-2">Mapeo de columnas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {INJURY_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                  </span>
                  <select
                    aria-label={f.label}
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

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="codigo-carga-lesiones" className="block text-sm font-medium mb-1">
                Código de acceso
              </label>
              <input
                id="codigo-carga-lesiones"
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
              {status === "submitting" ? "Importando…" : `Importar ${table.rows.length} filas`}
            </button>
          </div>

          {message && <p className={status === "error" ? "text-danger text-sm" : "text-accent-2 text-sm"}>{message}</p>}
          {notFound.length > 0 && (
            <p className="text-sm text-gold">
              No se encontraron {notFound.length} jugadores (revisá cómo está escrito el nombre): {notFound.join(", ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
