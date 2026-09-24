import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
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
/**
 * What each scoring event is worth, for a running score before a result
 * exists. Rugby league: try four, conversion and penalty goal two, drop goal
 * one. Everything else a recorder logs — tackles, sets, cards — scores
 * nothing and is left out.
 */
const SCORE_POINTS: Record<string, number> = {
  try: 4,
  conversion: 2,
  penalty_goal: 2,
  drop_goal: 1,
};

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
        .select("fixture_id, team_id, player:player_id(player_id, first_name, last_name)")
        .in("fixture_id", fixtureIds)
        .order("lineup_id", { ascending: true })
        .range(from, to)
    ),
  ]);

  // ── 2b. Who officiated, and who coached each side ────────────────────────
  // Officials are public, so the public client reads them.
  //
  // Coaches are read with the service key, because they live on team_sheets
  // and the public key only sees approved sheets. A coach set on an old match
  // through the recorder's backfill creates a draft sheet, and read publicly
  // every one of those would vanish. So: any sheet for a match already
  // played, and only approved ones for a match still to come — a club's
  // unpublished draft for next week stays its own. Names and ids only; the
  // register's phone numbers and emails never enter this query.
  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  const [appointments, sheets] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("fixture_officials")
        .select("fixture_id, role, official:official_id(official_id, first_name, last_name)")
        .in("fixture_id", fixtureIds)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      admin
        .from("team_sheets")
        .select(
          "fixture_id, team_id, status, head:head_coach_id(coach_id, first_name, last_name), assistant:assistant_coach_id(coach_id, first_name, last_name)"
        )
        .in("fixture_id", fixtureIds)
        .order("sheet_id", { ascending: true })
        .range(from, to)
    ),
  ]);

  // ── 2c. Match sheets: photos of the team sheets and scoring record ───────
  // Public, as they always were on the website. Read apart from the rest so
  // that, until supabase/match_sheets.sql has run, the schedule still loads.
  const sheetsByFixture = new Map<string, { kind: string; url: string }[]>();
  try {
    const docs = await fetchAllRows((from, to) =>
      supabase
        .from("fixture_documents")
        .select("fixture_id, kind, url")
        .in("fixture_id", fixtureIds)
        .order("created_at", { ascending: true })
        .order("document_id", { ascending: true })
        .range(from, to)
    );
    for (const d of docs as any[]) {
      const list = sheetsByFixture.get(d.fixture_id) ?? [];
      list.push({ kind: d.kind, url: d.url });
      sheetsByFixture.set(d.fixture_id, list);
    }
  } catch {
    // No table yet: no sheets, rather than no schedule.
  }

  const ROLE_WORDS: Record<string, string> = {
    referee: "Referee",
    touch_judge_1: "Touch judge",
    touch_judge_2: "Touch judge",
  };
  const ROLE_ORDER = ["referee", "touch_judge_1", "touch_judge_2"];

  const officialsByFixture = new Map<string, any[]>();
  for (const a of (appointments ?? []) as any[]) {
    const o = Array.isArray(a.official) ? a.official[0] : a.official;
    if (!o) continue;
    const list = officialsByFixture.get(a.fixture_id) ?? [];
    list.push({
      official_id: o.official_id,
      name: `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim(),
      role: ROLE_WORDS[a.role] ?? a.role,
      order: ROLE_ORDER.indexOf(a.role),
    });
    officialsByFixture.set(a.fixture_id, list);
  }

  const dateOf = new Map(fixtures.map((f: any) => [f.fixture_id, f.scheduled_date]));
  const coachesByFixtureTeam = new Map<string, any[]>();
  for (const s of (sheets ?? []) as any[]) {
    const date = dateOf.get(s.fixture_id);
    const past = !!date && date <= today;
    if (!past && s.status !== "approved") continue;

    const people = [
      { p: Array.isArray(s.head) ? s.head[0] : s.head, role: "Head coach" },
      { p: Array.isArray(s.assistant) ? s.assistant[0] : s.assistant, role: "Assistant coach" },
    ]
      .filter((x) => x.p)
      .map((x) => ({
        coach_id: x.p.coach_id,
        name: `${x.p.first_name ?? ""} ${x.p.last_name ?? ""}`.trim(),
        role: x.role,
      }));
    if (people.length) coachesByFixtureTeam.set(`${s.fixture_id}|${s.team_id}`, people);
  }

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

    // The score before there is a result. A result is written at full time,
    // so a match in progress has none, and this used to send null for the
    // whole of it — the website polled every twenty seconds and got the same
    // null back each time, which is why a live score never moved. Until the
    // result exists the score is what the scoring events add up to, the same
    // rule the federation's own live page has always used.
    const runningScore = (teamId: string): number | null => {
      let pts = 0;
      let any = false;
      for (const e of fixtureEvents) {
        if (e.team_id !== teamId) continue;
        const p = SCORE_POINTS[e.event_type as string];
        if (p === undefined) continue;
        pts += p;
        any = true;
      }
      return any ? pts : null;
    };

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

      const named = fixtureLineup.filter((l) => l.team_id === teamId);

      // Kept as plain names: the website renders this array directly.
      const roster = named
        .map((l) => `${(l.player as any)?.first_name ?? ""} ${(l.player as any)?.last_name ?? ""}`.trim())
        .filter(Boolean);

      // The same eleven with their ids, so a squad list can link to a profile
      // without matching on a name.
      const squad = named
        .map((l) => ({
          player_id: (l.player as any)?.player_id ?? null,
          name: `${(l.player as any)?.first_name ?? ""} ${(l.player as any)?.last_name ?? ""}`.trim(),
        }))
        .filter((p) => p.name);

      return {
        team_id: team?.team_id ?? null,
        name: team?.name ?? "",
        logo: team?.logo_url ?? null,
        slug: team?.slug ?? null,
        // A recorded result wins; before one exists, the running total.
        score: result
          ? teamId === homeId
            ? result.home_score
            : result.away_score
          : f.status === "live"
            ? // Under way and nobody has scored yet: nil-all, not blank.
              runningScore(teamId) ?? 0
            : runningScore(teamId),
        roster,
        squad,
        activities,
        // Who was in charge of this side, with ids so a page can link to
        // their profile.
        coaches: coachesByFixtureTeam.get(`${f.fixture_id}|${teamId}`) ?? [],
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
      // The clock as facts rather than as a minute. A minute would be stale
      // the moment it was sent; from these three a reader works out the
      // current minute itself, however late it loads the page.
      clock: {
        state: f.clock_state ?? "not_started",
        kickoff_at: f.kickoff_at ?? null,
        paused_at: f.paused_at ?? null,
        stoppage_seconds: f.stoppage_seconds ?? 0,
      },
      // The side that did not turn up, when a match was awarded rather than
      // played.
      forfeited_by: f.forfeited_by_team_id ?? null,
      date: f.scheduled_date
        ? `${f.scheduled_date}T${f.scheduled_time ?? "00:00:00"}`
        : null,
      round: f.round ?? null,
      venue: (f.venue as any)?.name ?? null,
      competition: (f.competition as any)?.name ?? null,
      competition_id: (f.competition as any)?.competition_id ?? null,
      season: (f.competition as any)?.season ?? null,
      highlights: result?.video_url ?? null,
      // Every sheet on the match; match_sheet is the first, under the name
      // the website's schedule used before it read this API.
      match_sheets: sheetsByFixture.get(f.fixture_id) ?? [],
      match_sheet: sheetsByFixture.get(f.fixture_id)?.[0]?.url ?? null,
      // Referee first, then the touch judges, each with an id to link to.
      officials: (officialsByFixture.get(f.fixture_id) ?? [])
        .sort((a, b) => a.order - b.order)
        .map(({ order, ...o }) => o),
      home_team: buildTeamSection(homeId, homeTeam),
      away_team: buildTeamSection(awayId, awayTeam),
    };
  });

  return ok(schedule, { cache: "short" });
}
