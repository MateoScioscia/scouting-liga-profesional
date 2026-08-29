"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { PlayerIndexItem } from "@/lib/queries";

const MAX_PLAYERS = 4;

export default function ComparePicker({
  index,
  selectedIds,
}: {
  index: PlayerIndexItem[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    return index
      .filter((p) => !selectedSet.has(p.id) && p.full_name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [q, index, selectedSet]);

  function setIds(ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length > 0) params.set("ids", ids.join(","));
    else params.delete("ids");
    router.push(`${pathname}?${params.toString()}`);
  }

  function addPlayer(id: string) {
    if (selectedIds.length >= MAX_PLAYERS) return;
    setIds([...selectedIds, id]);
    setQ("");
    setOpen(false);
  }

  function removePlayer(id: string) {
    setIds(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {selectedIds.map((id) => {
          const p = index.find((x) => x.id === id);
          return (
            <span
              key={id}
              className="flex items-center gap-2 rounded-full bg-surface-2 border border-border px-3 py-1.5 text-sm"
            >
              {p?.full_name ?? "Jugador"}
              <button
                onClick={() => removePlayer(id)}
                className="text-muted hover:text-danger transition-colors"
                aria-label="Quitar"
              >
                ×
              </button>
            </span>
          );
        })}
        {selectedIds.length === 0 && (
          <span className="text-muted text-sm py-1.5">Elegí hasta {MAX_PLAYERS} jugadores para comparar.</span>
        )}
      </div>

      {selectedIds.length < MAX_PLAYERS && (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Agregar jugador…"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {open && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface-2 shadow-lg overflow-hidden">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPlayer(p.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex justify-between gap-2"
                >
                  <span>{p.full_name}</span>
                  <span className="text-muted text-xs">{p.teams?.name ?? "—"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
