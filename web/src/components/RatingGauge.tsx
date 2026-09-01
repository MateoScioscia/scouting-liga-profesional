export default function RatingGauge({
  label,
  value,
  color = "var(--accent)",
  size = 92,
}: {
  label: string;
  value: number;
  color?: string;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} stroke="var(--border)" strokeWidth={stroke} fill="none" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
          {Math.round(clamped)}
        </div>
      </div>
      <div className="text-xs text-muted text-center leading-tight">{label}</div>
    </div>
  );
}
