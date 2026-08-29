import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Reads every row, not just the first page.
 *
 * PostgREST caps a response at max-rows — 1000 by default — and says nothing
 * when it truncates. The events query silently stopped at exactly 1000, so a
 * player's later matches vanished from anything built on the schedule while
 * still counting in their own profile. Rosters were at 937 and next in line.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const SIZE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < SIZE) return rows;
  }
}

// Per-player counters rather than things that happen at a minute mark.
const TALLY_EVENTS = new Set([
  "completed_set",
  "tackle",
  "missed_tackle",
  "offload",
  "metres_gained",
  "tackle_break",
  "clean_break",
  "turnover_won",
]);

/**
 * Events have been entered from three screens over the years, so the same
 * act appears as "penalty goal", "penalty_goal" and "penalty". Callers
 * should only ever see the canonical form.
 */
function normaliseEventType(value: string | null): string {
  const t = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return t === "penalty" ? "penalty_goal" : t;
}

export async function OPTIONS() {
  return preflight();
}

// GET /api/schedule
// Returns all fixtures in a shape compatible with the rlfgweb frontend.
// Each item includes scores, player activities (tries/conversions), and rosters
// so the website can compute standings and render match cards client-side.
//
// Optional query params:
//   ?season=2025        filter by competition season
//   ?competition=<id>   filter by competition_id
//   ?team=<id>          filter to fixtures involving this team_id
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const seasonFilter = url.searchParams.get("season");
  const competitionFilter = url.searchParams.get("competition");
  const teamFilter = url.searchParams.get("team");

  // ── 1. Fetch all fixtures ─────────────────────────────────────────────────
  let fixturesQuery = supabase
    .from("fixtures")
    .select(
      `*,
       home_team:home_team_id(team_id, name, logo_url, slug),
       away_team:away_team_id(team_id, name, logo_url, slug),
       venue:venue_id(name),
       competition:competition_id(competition_id, name, season, type)`
    )
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true });

  if (seasonFilter) {
    fixturesQuery = fixturesQuery.eq("competition.season", seasonFilter);
  }
  if (competitionFilter) {
    fixturesQuery = fixturesQuery.eq("competition_id", competitionFilter);
  }
  if (teamFilter) {
    fixturesQuery = fixturesQuery.or(
      `home_team_id.eq.${teamFilter},away_team_id.eq.${teamFilter}`
    );
  }

  const { data: fixtures, error: fixturesError } = await fixturesQuery;
  if (fixturesError) return fail(fixturesError.message, 500);
  if (!fixtures || fixtures.length === 0) return ok([]);

  const fixtureIds = fixtures.map((f) => f.fixture_id);

  // ── 2. Fetch results, events, and lineups for all fixtures in parallel ────
  // Every one of these can exceed a single PostgREST page, so each is read
  // through to the end. Paging needs a unique tiebreaker in the sort or rows
  // can repeat or be skipped between pages.
  const [results, events, lineups] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("match_results")
        .select("fixture_id, home_score, away_score, video_url")
        .in("fixture_id", fixtureIds)
        .order("result_id", { ascending: true })
        .range(from, to)
    ),

    fetchAllRows((from, to) =>
      supabase
        .from("match_events")
        .select(
          "fixture_id, event_type, minute, team_id, player:player_id(player_id, first_name, last_name)"
        )
        .in("fixture_id", fixtureIds)
        .order("minute", { ascending: true })
        .order("event_id", { ascending: true })
        .range(from, to)
    ),

    fetchAllRows((from, to) =>
      supabase
        .from("match_lineups")
        .select("fixture_id, team_id, player:player_id(first_name, last_name)")
        .in("fixture_id", fixtureIds)
        .order("lineup_id", { ascending: true })
        .range(from, to)
    ),
  ]);

  // ── 3. Index by fixture_id for O(1) lookups ───────────────────────────────
  type ResultRow = (typeof results)[number];
  type EventRow = (typeof events)[number];
  type LineupRow = (typeof lineups)[number];

  const resultMap = new Map<string, ResultRow>();
  for (const r of results ?? []) resultMap.set(r.fixture_id, r);

  const eventsByFixture = new Map<string, EventRow[]>();
  for (const e of events ?? []) {
    const list = eventsByFixture.get(e.fixture_id) ?? [];
    list.push(e);
    eventsByFixture.set(e.fixture_id, list);
  }

  const lineupsByFixture = new Map<string, LineupRow[]>();
  for (const l of lineups ?? []) {
    const list = lineupsByFixture.get(l.fixture_id) ?? [];
    list.push(l);
    lineupsByFixture.set(l.fixture_id, list);
  }

  // ── 4. Shape each fixture ─────────────────────────────────────────────────
  const schedule = fixtures.map((f) => {
    const result = resultMap.get(f.fixture_id) ?? null;
    const played = result !== null || f.status === "completed";

    const homeTeam = f.home_team as any;
    const awayTeam = f.away_team as any;
    const homeId = homeTeam?.team_id;
    const awayId = awayTeam?.team_id;

    const fixtureEvents = eventsByFixture.get(f.fixture_id) ?? [];
    const fixtureLineup = lineupsByFixture.get(f.fixture_id) ?? [];

    function buildTeamSection(teamId: string, team: any) {
      const activities = fixtureEvents
        .filter((e) => e.team_id === teamId)
        .map((e) => ({
          player: `${(e.player as any)?.first_name ?? ""} ${(e.player as any)?.last_name ?? ""}`.trim(),
          // So a scorer in a timeline or a records table can link to their
          // profile without matching on a name.
          player_id: (e.player as any)?.player_id ?? null,
          time: e.minute !== null ? String(e.minute) : "",
          activity_type: normaliseEventType(e.event_type),
        }))
        // Running tallies belong on a player's stat line, not in a match
        // timeline — a reader wants the moments, not fourteen completed sets.
        .filter((a) => !TALLY_EVENTS.has(a.activity_type));

      const roster = fixtureLineup
        .filter((l) => l.team_id === teamId)
        .map((l) => `${(l.player as any)?.first_name ?? ""} ${(l.player as any)?.last_name ?? ""}`.trim())
        .filter(Boolean);

      return {
        team_id: team?.team_id ?? null,
        name: team?.name ?? "",
        logo: team?.logo_url ?? null,
        slug: team?.slug ?? null,
        score: result ? (teamId === homeId ? result.home_score : result.away_score) : null,
        roster,
        activities,
      };
    }

    return {
      fixture_id: f.fixture_id,
      // Readable id matching the website's existing /fixtures/<slug> URLs.
      slug: f.slug ?? null,
      played,
      // scheduled | live | completed | postponed | cancelled. `played` alone
      // cannot distinguish a match in progress from a finished one.
      status: f.status ?? "scheduled",
      live: f.status === "live",
      date: f.scheduled_date
        ? `${f.scheduled_date}T${f.scheduled_time ?? "00:00:00"}`
        : null,
      round: f.round ?? null,
      venue: (f.venue as any)?.name ?? null,
      competition: (f.competition as any)?.name ?? null,
      competition_id: (f.competition as any)?.competition_id ?? null,
      season: (f.competition as any)?.season ?? null,
      highlights: result?.video_url ?? null,
      home_team: buildTeamSection(homeId, homeTeam),
      away_team: buildTeamSection(awayId, awayTeam),
    };
  });

  return ok(schedule, { cache: "short" });
}
