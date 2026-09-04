import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LiveClock } from "@/components/LiveClock";
import { fmtShortDate, fmtTime } from "@/lib/matchStats";
import { formatOf } from "@/lib/competitionFormat";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * A tint per format rather than per team — nobody has entered team colours,
 * and a wall of identical grey cards is the thing worth fixing here. Live
 * status still wins on top of whichever tint, via the gold score and pill.
 */
const FORMAT_TINT: Record<string, string> = {
  "13s": "from-navy-900 via-navy-950 to-neutral-950",
  "9s": "from-amber-950 via-neutral-950 to-neutral-950",
  erugby: "from-violet-950 via-neutral-950 to-neutral-950",
  beach: "from-cyan-950 via-neutral-950 to-neutral-950",
  presidents: "from-ghanaRed-950 via-neutral-950 to-neutral-950",
  origins: "from-ghanaGreen-950 via-neutral-950 to-neutral-950",
};
const DEFAULT_TINT = "from-neutral-900 to-neutral-900";

function TeamColumn({
  team,
}: {
  team: any;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <Avatar src={team?.logo_url} name={team?.name} size={40} />
      <span className="text-xs md:text-sm font-medium text-center leading-tight line-clamp-2 w-full">
        {team?.name ?? "TBC"}
      </span>
    </div>
  );
}

export function TeamBadge({
  team,
  align = "left",
}: {
  team: any;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Avatar src={team?.logo_url} name={team?.name} size={32} />
      <span className="font-medium text-sm md:text-base truncate">
        {team?.name ?? "TBC"}
      </span>
    </div>
  );
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ghanaRed-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ghanaRed-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-ghanaRed-500" />
        </span>
        Live
      </span>
    );
  }
  const label =
    status === "abandoned"
      ? "Abandoned"
      : status === "completed"
      ? "Full time"
      : status === "postponed"
      ? "Postponed"
      : status === "cancelled"
      ? "Cancelled"
      : "Upcoming";
  const tone =
    status === "completed"
      ? "text-emerald-400"
      : status === "postponed" || status === "cancelled" || status === "abandoned"
      ? "text-amber-400"
      : "text-slate-400";
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}

/**
 * One fixture row on the hub.
 *
 * Shows a final score where there is one, the running score while a match is
 * being played, and the kick-off time only when neither exists. liveScore is
 * added up from the events by the caller, because match_results is not
 * written until full time.
 */
export function MatchCard({
  fixture,
  liveScore,
}: {
  fixture: any;
  liveScore?: { home: number; away: number };
}) {
  const home = one<any>(fixture.home);
  const away = one<any>(fixture.away);
  const comp = one<any>(fixture.competition);
  const venue = one<any>(fixture.venue);
  const result = one<any>(fixture.result);

  // A recorded result wins; otherwise a match that has produced points is
  // showing its running score. A 0-0 that nobody has scored in yet stays as
  // a kick-off time rather than pretending to be a scoreline.
  const running =
    !result && liveScore && (liveScore.home > 0 || liveScore.away > 0)
      ? liveScore
      : null;
  const shown = result
    ? { home: result.home_score ?? 0, away: result.away_score ?? 0 }
    : running;
  const hasScore = !!shown;
  const isLive = fixture.status === "live";
  const tint = FORMAT_TINT[formatOf(comp?.name) ?? ""] ?? DEFAULT_TINT;

  return (
    <Link
      href={`/live/${fixture.fixture_id}`}
      className={`block rounded-2xl border border-white/10 bg-gradient-to-br ${tint} px-4 py-4 hover:border-white/25 transition`}
    >
      <div className="text-center text-[10px] uppercase tracking-wider text-slate-400 mb-3 truncate">
        {comp?.name ?? "Friendly"}
        {comp?.season ? ` · ${comp.season}` : ""}
        {fixture.round ? ` · ${fixture.round}` : ""}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <TeamColumn team={home} />

        <div className="text-center px-1 pt-1">
          {shown ? (
            <div
              className={`font-display text-3xl md:text-4xl tabular-nums leading-none whitespace-nowrap ${
                isLive ? "text-ghanaYellow-500" : "text-white"
              }`}
            >
              {shown.home}
              <span className="text-slate-600 mx-1">–</span>
              {shown.away}
            </div>
          ) : (
            <div className="text-slate-200 text-base font-semibold whitespace-nowrap">
              {fmtTime(fixture.scheduled_time) || "vs"}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap">
            <StatusPill status={fixture.status} />
            {/* Only while it is actually being played. Once it is over the
                pill already says Full time, and the clock's own "FT" beside
                it was the same thing said twice. */}
            {isLive && (
              <LiveClock
                fixture={fixture as any}
                className="text-ghanaYellow-500 text-[11px]"
              />
            )}
          </div>
        </div>

        <TeamColumn team={away} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-500">
        <span className="truncate">
          {fmtShortDate(fixture.scheduled_date)}
          {fixture.scheduled_time && hasScore
            ? ` · ${fmtTime(fixture.scheduled_time)}`
            : ""}
        </span>
        {venue?.name && <span className="truncate">· {venue.name}</span>}
      </div>
    </Link>
  );
}
