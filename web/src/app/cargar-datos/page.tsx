"use client";

import { useState } from "react";
import PlayersUploader from "@/components/PlayersUploader";
import MarketValuesUploader from "@/components/MarketValuesUploader";

const TABS = [
  { key: "players", label: "Estadísticas de jugadores" },
  { key: "market", label: "Valor de mercado" },
] as const;

export default function CargarDatosPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("players");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cargar datos</h1>
        <p className="text-muted mt-1">
          Subí un CSV o Excel con estadísticas o valor de mercado. Los datos quedan disponibles al instante en la base
          de jugadores. Esta sección está protegida por un código de acceso.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        {tab === "players" ? <PlayersUploader /> : <MarketValuesUploader />}
      </div>
    </div>
  );
}
