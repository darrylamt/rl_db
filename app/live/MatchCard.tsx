import Link from "next/link";
import { LiveClock } from "@/components/LiveClock";
import { fmtShortDate, fmtTime } from "@/lib/matchStats";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
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
      {team?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo_url}
          alt=""
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full object-cover bg-white/10 shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-white/10 text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">
          {(team?.name ?? "?").slice(0, 3).toUpperCase()}
        </div>
      )}
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
    status === "completed"
      ? "Full time"
      : status === "postponed"
      ? "Postponed"
      : status === "cancelled"
      ? "Cancelled"
      : "Upcoming";
  const tone =
    status === "completed"
      ? "text-emerald-400"
      : status === "postponed" || status === "cancelled"
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

  return (
    <Link
      href={`/live/${fixture.fixture_id}`}
      className="block bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 hover:border-white/25 hover:bg-neutral-800/70 transition"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5 text-[11px] text-slate-400">
        <span className="truncate">
          {comp?.name ?? "Friendly"}
          {comp?.season ? ` · ${comp.season}` : ""}
          {fixture.round ? ` · ${fixture.round}` : ""}
        </span>
        <StatusPill status={fixture.status} />
        <LiveClock fixture={fixture as any} className="text-ghanaYellow-500 text-xs ml-1.5" />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBadge team={home} />
        {shown ? (
          <div
            className={`font-display text-2xl md:text-3xl tabular-nums whitespace-nowrap px-2 ${
              isLive ? "text-ghanaYellow-500" : ""
            }`}
          >
            {shown.home}
            <span className="text-slate-600 mx-1.5">–</span>
            {shown.away}
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium whitespace-nowrap px-2">
            {fmtTime(fixture.scheduled_time) || "vs"}
          </div>
        )}
        <TeamBadge team={away} align="right" />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span className="truncate">
          {fmtShortDate(fixture.scheduled_date)}
          {fixture.scheduled_time && hasScore
            ? ` · ${fmtTime(fixture.scheduled_time)}`
            : ""}
        </span>
        <span className="truncate">{venue?.name ?? ""}</span>
      </div>
    </Link>
  );
}
