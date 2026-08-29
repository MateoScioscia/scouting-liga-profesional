"use client";

import { useState } from "react";
import { parseFile, parseEsNumber, type ParsedTable } from "@/lib/parseFile";
import { MARKET_VALUE_FIELDS, guessMapping } from "@/lib/fieldDefs";
import { getSupabase } from "@/lib/supabase";

const CHUNK_SIZE = 150;

type MarketValueRow = {
  full_name: string;
  nationality: string;
  value_date: string;
  value_amount: number | null;
  currency: string;
  source: string;
};

export default function MarketValuesUploader() {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFile(file: File) {
    setStatus("idle");
    setMessage("");
    const parsed = await parseFile(file);
    setTable(parsed);
    setMapping(guessMapping(parsed.headers, MARKET_VALUE_FIELDS));
    setStatus("ready");
  }

  function buildRows(): MarketValueRow[] {
    if (!table) return [];
    return table.rows
      .map((row) => ({
        full_name: String(row[mapping["full_name"]] ?? "").trim(),
        nationality: String(row[mapping["nationality"]] ?? ""),
        value_date: String(row[mapping["value_date"]] ?? "").trim(),
        value_amount: parseEsNumber(row[mapping["value_amount"]]),
        currency: String(row[mapping["currency"]] ?? "EUR") || "EUR",
        source: String(row[mapping["source"]] ?? ""),
      }))
      .filter((r) => r.full_name && r.value_date && r.value_amount !== null);
  }

  async function handleSubmit() {
    if (!passcode) {
      setMessage("Ingresá el código de acceso.");
      setStatus("error");
      return;
    }
    const rows = buildRows();
    if (rows.length === 0) {
      setMessage("No hay filas válidas (revisá el mapeo: nombre, fecha y valor son obligatorios).");
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
        const { data, error } = await supabase.rpc("admin_import_market_values", { passcode, rows: chunk });
        if (error) throw error;
        inserted += data?.inserted ?? chunk.length;
        setProgress({ done: Math.min(i + CHUNK_SIZE, rows.length), total: rows.length });
      }
      setStatus("done");
      setMessage(`Listo: se cargaron ${inserted} registros de valor de mercado.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error desconocido al importar.");
    }
  }

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
          Columnas esperadas: nombre del jugador, fecha (AAAA-MM-DD) y valor. Podés agregar una fila por cada fecha para
          armar el historial.
        </p>
      </div>

      {table && (
        <>
          <div>
            <h3 className="text-sm font-medium mb-2">Mapeo de columnas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {MARKET_VALUE_FIELDS.map((f) => (
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

          {message && <p className={status === "error" ? "text-danger text-sm" : "text-accent-2 text-sm"}>{message}</p>}
        </>
      )}
    </div>
  );
}
