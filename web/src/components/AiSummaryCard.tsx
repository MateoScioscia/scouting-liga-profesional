import { formatDate } from "@/lib/format";

export default function AiSummaryCard({ summary, generatedAt }: { summary: string; generatedAt: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h2 className="font-medium">Resumen (generado por IA)</h2>
        <span className="text-[10px] rounded-full border border-gold/40 bg-gold/10 text-gold px-2 py-0.5">
          Generado automáticamente
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        Texto escrito por IA a partir de las estadísticas reales del jugador — puede contener errores o
        imprecisiones. No reemplaza el análisis de un scout.
      </p>
      <p className="text-sm leading-relaxed">{summary}</p>
      {generatedAt && <p className="text-[11px] text-muted mt-3">Generado el {formatDate(generatedAt)}.</p>}
    </div>
  );
}
