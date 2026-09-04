export default function SummaryCard({ summary }: { summary: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h2 className="font-medium">Resumen</h2>
        <span className="text-[10px] rounded-full border border-border bg-surface-2 text-muted px-2 py-0.5">
          Generado automáticamente
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        Texto armado a partir de las estadísticas y percentiles reales del jugador — sin IA de por medio, solo
        combina los datos que ya se muestran abajo en una frase legible.
      </p>
      <p className="text-sm leading-relaxed">{summary}</p>
    </div>
  );
}
