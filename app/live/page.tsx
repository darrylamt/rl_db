import { createPublicClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchCard } from "./MatchCard";

// Scores must never be served stale.
export const dynamic = "force-dynamic";

const FIXTURE_SELECT =
  "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(team_id, name, logo_url), away:away_team_id(team_id, name, logo_url), venue:venue_id(name), competition:competition_id(name, season), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
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

  const todaysMatches = (todayRows ?? []).filter(
    (f: any) => !liveIds.has(f.fixture_id)
  );
  const todayIds = new Set(todaysMatches.map((f: any) => f.fixture_id));

  // A 0–0 row is how an unplayed fixture looks before anyone enters a score,
  // so only surface results where something was actually scored.
  const results = (playedRows ?? [])
    .filter((f: any) => {
      if (liveIds.has(f.fixture_id) || todayIds.has(f.fixture_id)) return false;
      const r = one<any>(f.result);
      return !!r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0);
    })
    .slice(0, 12);

  const upcoming = (upcomingRows ?? [])
    .filter(
      (f: any) => !liveIds.has(f.fixture_id) && !todayIds.has(f.fixture_id)
    )
    .slice(0, 8);

  const nothingAtAll =
    live.length === 0 &&
    todaysMatches.length === 0 &&
    results.length === 0 &&
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
            <MatchCard key={f.fixture_id} fixture={f} />
          ))}
        </Section>
      )}

      {todaysMatches.length > 0 && (
        <Section title="Today" subtitle="Kick-off times">
          {todaysMatches.map((f: any) => (
            <MatchCard key={f.fixture_id} fixture={f} />
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

      {results.length > 0 && (
        <Section title="Latest results" subtitle="Most recent first">
          {results.map((f: any) => (
            <MatchCard key={f.fixture_id} fixture={f} />
          ))}
        </Section>
      )}

      {nothingAtAll && (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          No matches to show yet. Check back on match day.
        </p>
      )}
    </>
  );
}
