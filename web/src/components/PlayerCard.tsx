import Link from "next/link";
import type { PlayerListItem } from "@/lib/queries";
import { POSITION_LABELS, POSITION_COLORS } from "@/lib/metrics";
import { TIER_COLORS, type PlayerRating } from "@/lib/rating";
import { computeSampleWarning } from "@/lib/sampleSize";
import { formatNumber } from "@/lib/format";
import SampleWarningBadge from "./SampleWarningBadge";
import Avatar from "./Avatar";
import TeamLogo from "./TeamLogo";

export default function PlayerCard({
  player,
  rating,
  teamMatches,
}: {
  player: PlayerListItem;
  rating: PlayerRating | null;
  teamMatches?: number;
}) {
  const stats = player.season_stats[0];
  const posColor = player.position_group ? POSITION_COLORS[player.position_group] : "var(--muted)";
  const tierColor = rating ? TIER_COLORS[rating.tier] : "var(--muted)";
  const sampleWarning = computeSampleWarning(stats?.matches_played, teamMatches);

  return (
    <Link
      href={`/jugadores/${player.id}`}
      className="group rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 hover:border-accent/40 hover:bg-surface-2/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={player.photo_url} name={player.full_name} color={posColor} size={40} />
          <div className="min-w-0">
            <div className="font-medium truncate group-hover:text-accent-2 transition-colors">{player.full_name}</div>
            <div className="text-xs text-muted truncate flex items-center gap-1.5">
              <TeamLogo src={player.teams?.logo_url} name={player.teams?.name ?? ""} size={14} />
              {player.teams?.name ?? "Sin equipo"}
            </div>
          </div>
        </div>
        {rating && (
          <span
            className="text-[10px] font-medium rounded-full px-2 py-0.5 border shrink-0"
            style={{ color: tierColor, borderColor: `${tierColor}66`, background: `${tierColor}1a` }}
          >
            {rating.tier}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {player.position_group && (
          <span
            className="text-[10px] font-medium rounded px-1.5 py-0.5"
            style={{ color: posColor, background: `${posColor}22` }}
          >
            {POSITION_LABELS[player.position_group]}
          </span>
        )}
        {rating && (
          <span className="text-2xl font-semibold tabular-nums" style={{ color: tierColor }}>
            {Math.round(rating.overall)}
          </span>
        )}
        {sampleWarning && <SampleWarningBadge warning={sampleWarning} compact />}
      </div>

      {rating && (
        <div className="flex flex-col gap-1.5">
          {rating.categories.slice(0, 3).map((c) => (
            <div key={c.category} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 shrink-0 text-muted truncate">{c.category}</span>
              <span className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(c.score, 2)}%`, background: tierColor }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border/60">
        <span>{formatNumber(stats?.minutes_played ?? undefined)}&apos; jugados</span>
        <span>
          {stats?.goals ?? 0}G · {stats?.assists ?? 0}A
        </span>
      </div>
    </Link>
  );
}
