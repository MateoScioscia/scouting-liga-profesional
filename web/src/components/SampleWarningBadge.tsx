import type { SampleWarning } from "@/lib/sampleSize";

export default function SampleWarningBadge({
  warning,
  compact = false,
}: {
  warning: SampleWarning;
  compact?: boolean;
}) {
  const text = `Jugó ${warning.matchesPlayed} de ${warning.teamMatches} partidos posibles del equipo`;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border border-gold/40 bg-gold/10 text-gold"
        title={`${text} — el rating puede no ser representativo.`}
      >
        ⚠ {warning.matchesPlayed}/{warning.teamMatches} PJ
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold flex items-center gap-2">
      <span>⚠</span>
      <span>
        <strong>Muestra chica:</strong> {text} — el rating y los percentiles pueden no ser representativos.
      </span>
    </div>
  );
}
