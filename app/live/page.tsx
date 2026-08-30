import { createPublicClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchCard } from "./MatchCard";
import { pointsFrom } from "@/lib/matchStats";

// Scores must never be served stale.
export const dynamic = "force-dynamic";

const FIXTURE_SELECT =
  "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(team_id, name, logo_url), away:away_team_id(team_id, name, logo_url), venue:venue_id(name), competition:competition_id(name, season), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id";

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

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-xl md:text-2xl text-white">{title}</h2>
        {subtitle && (
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            {subtitle}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default async function LiveHubPage() {
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: liveRows },
    { data: todayRows },
    { data: playedRows },
    { data: upcomingRows },
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

    // Next up
    supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .gte("scheduled_date", today)
      .eq("status", "scheduled")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(12),
  ]);

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
  const upcoming = (upcomingRows ?? [])
    .filter(
      (f: any) => !liveIds.has(f.fixture_id) && !todayIds.has(f.fixture_id)
    )
    .slice(0, 8);

  const nothingAtAll =
    live.length === 0 &&
    todaysMatches.length === 0 &&
    resultDays.length === 0 &&
    upcoming.length === 0;

  return (
    <>
      <LiveRefresh tables={["fixtures", "match_results", "match_events"]} />

      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          Live Scores
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Follow every Rugby League Federation Ghana match — scores and stats
          update on this page as they are recorded, no refresh needed.
        </p>
      </div>

      {live.length > 0 && (
        <Section title="Live now" subtitle={`${live.length} in progress`}>
          {live.map((f: any) => (
            <MatchCard
              key={f.fixture_id}
              fixture={f}
              liveScore={scoreFor.get(f.fixture_id)}
            />
          ))}
        </Section>
      )}

      {todaysMatches.length > 0 && (
        <Section title="Today" subtitle="Kick-off times">
          {todaysMatches.map((f: any) => (
            <MatchCard
              key={f.fixture_id}
              fixture={f}
              liveScore={scoreFor.get(f.fixture_id)}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Coming up">
          {upcoming.map((f: any) => (
            <MatchCard key={f.fixture_id} fixture={f} />
          ))}
        </Section>
      )}

      {resultDays.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl md:text-2xl text-white mb-3">
            Results
          </h2>
          {resultDays.map(({ date, matches }) => (
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
          ))}
        </section>
      )}

      {nothingAtAll && (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          No matches to show yet. Check back on match day.
        </p>
      )}
    </>
  );
}
