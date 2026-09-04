import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchCard } from "./MatchCard";
import { Avatar } from "@/components/Avatar";
import { PredictionCard } from "@/components/live/PredictionCard";
import { getPredictionCountsFor, kickoffAt } from "@/lib/predictions";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
import { pointsFrom, FIXTURE_SELECT, fmtShortDate, fmtTime } from "@/lib/matchStats";

// Scores must never be served stale.
export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * "Today", "Yesterday", or the date written out.
 *
 * A run of results all headed 30/08/2026 tells a reader nothing they cannot
 * work out; the two days that need naming are the two they are most likely
 * to be looking for.
 */
function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";

  const d = new Date(`${date}T00:00:00`);
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "Today at 15:00" where that is true, otherwise the date and the time.
 * The two lines on the poll card are small, so the day is worth naming
 * rather than making somebody read a date to work out it is tonight.
 */
function kickoffLabel(
  date: string | null,
  time: string | null,
  today: string
): string {
  const when = fmtTime(time);
  if (!date) return when || "Date to be confirmed";

  const d = new Date(`${date}T00:00:00`);
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const day =
    date === today
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
      ? "Tomorrow"
      : fmtShortDate(date);

  return when ? `${day} at ${when}` : day;
}

/** Played matches, newest day first, each day keeping its kick-off order. */
function byDay(fixtures: any[]): { date: string; matches: any[] }[] {
  const days = new Map<string, any[]>();
  for (const f of fixtures) {
    const key = f.scheduled_date ?? "";
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(f);
  }
  return Array.from(days)
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, matches]) => ({ date, matches }));
}

// Upcoming, Today, Results — the day runs left to right, so what is next
// sits ahead of now and what is done sits behind it.
const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "results", label: "Results" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function LiveHubPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: liveRows },
    { data: todayRows },
    { data: playedRows },
    { data: upcomingRows },
    { data: clubRows },
  ] = await Promise.all([
    // In progress right now
    supabase
      .from("fixtures")
      .select(`${FIXTURE_SELECT}, result:match_results(home_score, away_score)`)
      .eq("status", "live")
      .order("scheduled_time", { ascending: true, nullsFirst: false }),

    // Everything else kicking off today
    supabase
      .from("fixtures")
      .select(`${FIXTURE_SELECT}, result:match_results(home_score, away_score)`)
      .eq("scheduled_date", today)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),

    // Latest finished matches — most recent first
    supabase
      .from("fixtures")
      .select(
        `${FIXTURE_SELECT}, result:match_results!inner(home_score, away_score)`
      )
      .order("scheduled_date", { ascending: false, nullsFirst: false })
      .order("scheduled_time", { ascending: false, nullsFirst: false })
      .limit(30),

    // Next up — its own tab now rather than a teaser at the foot of the page,
    // so it earns a longer list than the 12 it used to share room for.
    supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .gte("scheduled_date", today)
      .eq("status", "scheduled")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(24),

    // Clubs row at the top of the page. brand_color arrives with
    // supabase/team_brand_color.sql and is read separately from the fixture
    // query on purpose — a column that is not there yet must not take the
    // scores down with it.
    readWithOptionalColumns(
      "team_id, name, logo_url, brand_color",
      ["brand_color"],
      (columns) =>
        supabase
          .from("teams")
          .select(columns)
          .eq("team_type", "club")
          .neq("is_public", false)
          .order("name")
    ),
  ]);

  const clubs = (clubRows ?? []) as any[];
  const brandColour = new Map<string, string | null>(
    clubs.map((c: any) => [c.team_id, c.brand_color ?? null])
  );

  const live = liveRows ?? [];
  const liveIds = new Set(live.map((f: any) => f.fixture_id));

  /**
   * The running score of a match in progress.
   *
   * match_results is written at full time, so a live match has no row there
   * and the card fell back to showing its kick-off time — the one moment
   * someone opening this page actually wants a number. The score is added up
   * from the events instead, the same way the match centre does it.
   */
  const inPlay = [...live, ...(todayRows ?? [])].filter((f: any) => !one<any>(f.result));
  const inPlayIds = Array.from(new Set(inPlay.map((f: any) => f.fixture_id)));

  const { data: liveEvents } = inPlayIds.length
    ? await supabase
        .from("match_events")
        .select("fixture_id, event_type, team_id, player:player_id(team_id)")
        .in("fixture_id", inPlayIds)
    : { data: [] as any[] };

  const scoreFor = new Map<string, { home: number; away: number }>();
  for (const f of inPlay as any[]) {
    const homeId = one<any>(f.home)?.team_id;
    const awayId = one<any>(f.away)?.team_id;
    // An event can land without a team_id; the player it is credited to says
    // which side it belongs to.
    const side = (e: any) => e.team_id ?? one<any>(e.player)?.team_id ?? null;
    const mine = (liveEvents ?? []).filter((e: any) => e.fixture_id === f.fixture_id);
    scoreFor.set(f.fixture_id, {
      home: pointsFrom(mine.filter((e: any) => side(e) === homeId)),
      away: pointsFrom(mine.filter((e: any) => side(e) === awayId)),
    });
  }

  /** Something was actually scored — a 0-0 row is an unplayed fixture. */
  const hasScore = (f: any) => {
    const r = one<any>(f.result);
    return !!r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0);
  };

  // A match played today belongs under Today in the results, not in the
  // list of kick-off times still to come.
  const todaysMatches = (todayRows ?? []).filter(
    (f: any) => !liveIds.has(f.fixture_id) && !hasScore(f)
  );

  // A 0–0 row is how an unplayed fixture looks before anyone enters a score,
  // so only surface results where something was actually scored.
  const results = (playedRows ?? [])
    .filter((f: any) => !liveIds.has(f.fixture_id) && hasScore(f))
    .slice(0, 24);
  const resultDays = byDay(results);

  const todayIds = new Set(todaysMatches.map((f: any) => f.fixture_id));
  const upcoming = (upcomingRows ?? []).filter(
    (f: any) => !liveIds.has(f.fixture_id) && !todayIds.has(f.fixture_id)
  );

  // Today whenever there is something to show today; otherwise whichever tab
  // is not empty, so a Tuesday morning does not land on a blank "Today".
  const todayCount = live.length + todaysMatches.length;
  const defaultTab: TabKey =
    todayCount > 0 ? "today" : resultDays.length > 0 ? "results" : "upcoming";
  const requested = searchParams?.tab;
  const tab: TabKey = (TABS.find((t) => t.key === requested)?.key ??
    defaultTab) as TabKey;

  // The games worth asking a fan to call — the earliest kick-offs nobody has
  // seen the result of yet. Live is deliberately excluded: that game is
  // already being decided, not predicted. Five is enough to page through
  // without turning the card into a fixture list.
  // Only what has not kicked off. A match today at noon is still in
  // todaysMatches at three o'clock, and asking who will win it then is not a
  // prediction.
  const pollFixtures = ([...todaysMatches, ...upcoming] as any[])
    .filter((f) => {
      const at = kickoffAt(f.scheduled_date, f.scheduled_time);
      return at == null || at > Date.now();
    })
    .slice(0, 5);
  const pollCounts = await getPredictionCountsFor(
    pollFixtures.map((f) => f.fixture_id)
  );
  const withColour = (t: any) =>
    t ? { ...t, brandColor: brandColour.get(t.team_id) ?? null } : t;

  const pollMatches = pollFixtures.map((f) => ({
    fixtureId: f.fixture_id,
    home: withColour(one<any>(f.home)),
    away: withColour(one<any>(f.away)),
    competition: one<any>(f.competition)?.name ?? "Next match",
    kickoff: kickoffLabel(f.scheduled_date, f.scheduled_time, today),
    closesAt: (() => {
      const at = kickoffAt(f.scheduled_date, f.scheduled_time);
      return at == null ? null : new Date(at).toISOString();
    })(),
    counts: pollCounts[f.fixture_id] ?? { home: 0, away: 0 },
  }));

  return (
    <>
      <LiveRefresh tables={["fixtures", "match_results", "match_events"]} />

      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          Ghana Rugby League
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Every club, every fixture, every result — updating as officials
          record them. Call the next game before it kicks off.
        </p>
      </div>

      {/* Clubs — stacked into rows rather than a scroller, so every club is
          on screen at once instead of hidden off the side. */}
      {clubs.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-x-2 gap-y-4 mb-6">
          {clubs.map((c: any) => (
            <Link
              key={c.team_id}
              href={`/live/club/${c.team_id}`}
              className="flex flex-col items-center gap-1.5 group min-w-0"
            >
              <span className="w-14 h-14 rounded-full bg-neutral-900 border border-white/10 group-hover:border-white/30 transition flex items-center justify-center overflow-hidden">
                <Avatar src={c.logo_url} name={c.name} size={40} contain />
              </span>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-200 text-center leading-tight line-clamp-2 w-full">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Who will win? */}
      {pollMatches.length > 0 && <PredictionCard matches={pollMatches} />}

      {/* Day tabs */}
      <div className="flex bg-neutral-900 border border-white/10 rounded-full p-1 mb-6 max-w-sm">
        {TABS.map((t) => {
          const count =
            t.key === "today"
              ? todayCount
              : t.key === "results"
              ? results.length
              : upcoming.length;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === defaultTab ? "/live" : `/live?tab=${t.key}`}
              className={`relative flex-1 text-center text-sm font-medium rounded-full py-1.5 transition ${
                active
                  ? "bg-white text-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {t.label}
              {t.key === "today" && live.length > 0 && !active && (
                <span className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-ghanaRed-500 animate-pulse" />
              )}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    active ? "text-black/50" : "text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "today" && (
        <div className="space-y-2">
          {live.map((f: any) => (
            <MatchCard
              key={f.fixture_id}
              fixture={f}
              liveScore={scoreFor.get(f.fixture_id)}
            />
          ))}
          {todaysMatches.map((f: any) => (
            <MatchCard
              key={f.fixture_id}
              fixture={f}
              liveScore={scoreFor.get(f.fixture_id)}
            />
          ))}
          {todayCount === 0 && (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
              Nothing on today. Check Upcoming for what&apos;s next.
            </p>
          )}
        </div>
      )}

      {tab === "results" && (
        <>
          {resultDays.length > 0 ? (
            resultDays.map(({ date, matches }) => (
              <div key={date} className="mb-6 last:mb-0">
                <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 pb-1 border-b border-white/10">
                  {date ? dayLabel(date, today) : "Date unknown"}
                </h3>
                <div className="space-y-2">
                  {matches.map((f: any) => (
                    <MatchCard key={f.fixture_id} fixture={f} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
              No results recorded yet.
            </p>
          )}
        </>
      )}

      {tab === "upcoming" && (
        <div className="space-y-2">
          {upcoming.length > 0 ? (
            upcoming.map((f: any) => <MatchCard key={f.fixture_id} fixture={f} />)
          ) : (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
              Nothing scheduled yet.
            </p>
          )}
        </div>
      )}
    </>
  );
}
