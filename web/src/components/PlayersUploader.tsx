"use client";

import { useState } from "react";
import { parseFile, parseEsNumber, type ParsedTable } from "@/lib/parseFile";
import { PLAYER_FIELDS, guessMapping } from "@/lib/fieldDefs";
import { inferPositionGroup } from "@/lib/football";
import { getSupabase } from "@/lib/supabase";

const CHUNK_SIZE = 150;

type PlayerRow = {
  full_name: string;
  nationality: string;
  position: string;
  team: string;
  matches_played: number | null;
  starts: number | null;
  minutes_played: number | null;
  nineties: number | null;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  position_group: string;
  stats: Record<string, number>;
};

export default function PlayersUploader() {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [season, setSeason] = useState("2026");
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFile(file: File) {
    setStatus("idle");
    setMessage("");
    const parsed = await parseFile(file);
    setTable(parsed);
    setMapping(guessMapping(parsed.headers, PLAYER_FIELDS));
    setStatus("ready");
  }

  function buildRows(): PlayerRow[] {
    if (!table) return [];
    const mappedHeaders = new Set(Object.values(mapping));
    return table.rows.map((row) => {
      const stats: Record<string, number> = {};
      for (const [header, value] of Object.entries(row)) {
        if (mappedHeaders.has(header) && header !== mapping["edad"]) continue;
        const n = parseEsNumber(value);
        if (n !== null) stats[header] = n;
      }
      const position = String(row[mapping["position"]] ?? "");
      const edad = parseEsNumber(row[mapping["edad"]]);
      if (edad !== null) stats["edad"] = edad;
      return {
        full_name: String(row[mapping["full_name"]] ?? "").trim(),
        nationality: String(row[mapping["nationality"]] ?? ""),
        position,
        team: String(row[mapping["team"]] ?? ""),
        matches_played: parseEsNumber(row[mapping["matches_played"]]),
        starts: parseEsNumber(row[mapping["starts"]]),
        minutes_played: parseEsNumber(row[mapping["minutes_played"]]),
        nineties: parseEsNumber(row[mapping["nineties"]]),
        goals: parseEsNumber(row[mapping["goals"]]),
        assists: parseEsNumber(row[mapping["assists"]]),
        yellow_cards: parseEsNumber(row[mapping["yellow_cards"]]),
        red_cards: parseEsNumber(row[mapping["red_cards"]]),
        position_group: inferPositionGroup(position),
        stats,
      };
    }).filter((r) => r.full_name);
  }

  async function handleSubmit() {
    if (!passcode) {
      setMessage("Ingresá el código de acceso.");
      setStatus("error");
      return;
    }
    const rows = buildRows();
    if (rows.length === 0) {
      setMessage("No hay filas válidas para importar (revisá el mapeo de columnas).");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setMessage("");
    setProgress({ done: 0, total: rows.length });
    const supabase = getSupabase();
    let inserted = 0;
    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase.rpc("admin_import_players", {
          passcode,
          p_season: season,
          rows: chunk,
        });
        if (error) throw error;
        inserted += data?.inserted ?? chunk.length;
        setProgress({ done: Math.min(i + CHUNK_SIZE, rows.length), total: rows.length });
      }
      setStatus("done");
      setMessage(`Listo: se importaron/actualizaron ${inserted} jugadores para la temporada ${season}.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error desconocido al importar.");
    }
  }

  const previewRows = table?.rows.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-medium mb-1">Archivo (.csv, .xlsx)</label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#06170e] hover:file:bg-accent-2"
        />
        <p className="text-xs text-muted mt-1">
          Funciona con el CSV exportado por el script de scraping (FBref, separado por &quot;;&quot; y coma decimal) o con
          cualquier CSV/Excel propio — mapeá las columnas abajo.
        </p>
      </div>

      {table && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Temporada</label>
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-40 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Mapeo de columnas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {PLAYER_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">
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
            <p className="text-xs text-muted mt-2">
              Las columnas numéricas no mapeadas se guardan igual como estadísticas adicionales del jugador.
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-thin rounded-lg border border-border">
            <table className="text-xs min-w-full">
              <thead>
                <tr className="bg-surface-2 text-muted">
                  {table.headers.slice(0, 8).map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-border/50">
                    {table.headers.slice(0, 8).map((h) => (
                      <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
              {status === "submitting" ? `Importando… (${progress.done}/${progress.total})` : `Importar ${table.rows.length} filas`}
            </button>
          </div>

          {message && (
            <p className={status === "error" ? "text-danger text-sm" : "text-accent-2 text-sm"}>{message}</p>
          )}
        </>
      )}
    </div>
  );
}
