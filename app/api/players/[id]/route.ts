import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { embedded, fetchLineupAppearances } from "@/lib/appearances";
import { averageRating, matchRatings } from "@/lib/matchRating";
import { currentSuspensions } from "@/lib/suspensions";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/players/:id
// Returns the player profile plus career stats aggregated from match_events,
// the same stats season by season, and a rating for each match.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createPublicClient();
  const { id } = params;

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: player, error: playerError },
    { data: events },
    lineups,
    { data: contracts },
    { data: ratings },
  ] =
    await Promise.all([
      supabase
        .from("public_players")
        // public_players already excludes phone/email, so "*" is safe here and
        // keeps working before/after the attribute columns are added.
        .select("*")
        .eq("player_id", id)
        .maybeSingle(),

      // All scoring/discipline events for the player — used to build stats.
      // The fixture's season and date say which year each one belongs to.
      supabase
        .from("match_events")
        .select("event_type, fixture_id, fixture:fixture_id(fixture_id, scheduled_date, competition:competition_id(season))")
        .eq("player_id", id),

      // Squad selections — a player appears in a match even with no events
      fetchLineupAppearances(supabase, id),

      // The contract running now, as /live shows it: whose, and until when.
      // Only accepted contracts are readable without an account, and the
      // terms are left out on purpose.
      supabase
        .from("contracts")
        .select("starts_on, ends_on, team:team_id(name, slug)")
        .eq("player_id", id)
        .eq("status", "accepted")
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("ends_on", { ascending: false })
        .limit(1),

      // Ratings entered by hand, out of ten. They win over the worked-out one.
      supabase.from("match_player_ratings").select("fixture_id, rating").eq("player_id", id),
    ]);

  if (playerError) return fail(playerError.message, 500);
  if (!player) return fail("Player not found", 404);

  const allEvents = (events ?? []) as any[];

  // Distinct fixtures the player was selected for or recorded an event in
  const playedFixtureIds = new Set<string>(
    allEvents.map((e: any) => e.fixture_id).filter(Boolean)
  );
  for (const l of lineups) {
    if (l.fixture?.fixture_id) playedFixtureIds.add(l.fixture.fixture_id);
  }

  // Which year each match belongs to: its competition's season, or the
  // year it was played where the competition has none.
  const seasonOf = new Map<string, string>();
  const noteSeason = (f: any) => {
    if (!f?.fixture_id || seasonOf.has(f.fixture_id)) return;
    const season =
      embedded<any>(f.competition)?.season ??
      (f.scheduled_date ? String(f.scheduled_date).slice(0, 4) : null);
    if (season) seasonOf.set(f.fixture_id, String(season));
  };
  for (const e of allEvents) noteSeason(embedded<any>(e.fixture));
  for (const l of lineups) noteSeason(l.fixture);

  // A rating for each match, as the match page gives it: worked out from
  // what they did, unless somebody entered one by hand.
  const eventsByFixture = new Map<string, any[]>();
  for (const e of allEvents) {
    if (!e.fixture_id) continue;
    const list = eventsByFixture.get(e.fixture_id) ?? [];
    list.push({ player_id: id, event_type: e.event_type });
    eventsByFixture.set(e.fixture_id, list);
  }
  const positionIn = new Map<string, string | null>(
    lineups
      .filter((l) => l.fixture?.fixture_id)
      .map((l) => [l.fixture.fixture_id, l.position ?? null])
  );
  const storedIn = new Map<string, any>(
    ((ratings ?? []) as any[]).filter((r) => r.fixture_id).map((r) => [r.fixture_id, r.rating])
  );
  const ratedFixtures = Array.from(
    new Set([...Array.from(eventsByFixture.keys()), ...Array.from(storedIn.keys())])
  );
  const matchRatingList = ratedFixtures
    .map((fixtureId) => {
      const rating = matchRatings(
        eventsByFixture.get(fixtureId) ?? [],
        new Map([[id, positionIn.get(fixtureId)]]),
        storedIn.has(fixtureId) ? [{ player_id: id, rating: storedIn.get(fixtureId) }] : []
      ).get(id);
      return rating == null ? null : { fixture_id: fixtureId, rating };
    })
    .filter(Boolean) as { fixture_id: string; rating: number }[];

  // The same numbers a year at a time, newest first.
  const years = new Map<string, { events: any[]; fixtures: Set<string>; ratings: number[] }>();
  const yearOf = (fixtureId: string | null | undefined) => {
    const season = fixtureId ? seasonOf.get(fixtureId) : undefined;
    if (!season) return null;
    if (!years.has(season)) years.set(season, { events: [], fixtures: new Set(), ratings: [] });
    return years.get(season)!;
  };
  for (const e of allEvents) {
    const y = yearOf(e.fixture_id);
    if (y) {
      y.events.push(e);
      y.fixtures.add(e.fixture_id);
    }
  }
  for (const l of lineups) {
    if (l.fixture?.fixture_id) yearOf(l.fixture.fixture_id)?.fixtures.add(l.fixture.fixture_id);
  }
  for (const r of matchRatingList) yearOf(r.fixture_id)?.ratings.push(r.rating);
  const seasons = Array.from(years.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([season, y]) => ({
      season,
      match_rating: averageRating(y.ratings),
      ...summarise(y.events, y.fixtures.size),
    }));

  // "*" keeps this resilient to the view gaining columns, so the two that
  // must not go out are taken back off here rather than by enumerating every
  // other column and having to remember this file each time one is added.
  const { date_of_birth, age, ...publicPlayer } = player as any;

  const suspension = (await currentSuspensions(supabase, [id])).get(id) ?? null;

  const c = ((contracts ?? []) as any[])[0] ?? null;
  const contractTeam = c ? (Array.isArray(c.team) ? c.team[0] : c.team) : null;

  return ok({
    ...publicPlayer,
    // Serving a ban today: until when (never why).
    suspension,
    contract: c
      ? { club: contractTeam?.name ?? null, club_slug: contractTeam?.slug ?? null, starts_on: c.starts_on, ends_on: c.ends_on }
      : null,
    // Out of ten: the average, and each match's own.
    match_rating: averageRating(matchRatingList.map((r) => r.rating)),
    match_ratings: matchRatingList,
    stats: summarise(allEvents, playedFixtureIds.size),
    seasons,
  });
}

/** Stats from a set of events, for a career or for one season. */
function summarise(events: { event_type: string }[], matchesPlayed: number) {
  const stats = aggregateStats(events);
  return {
    matches_played: matchesPlayed,
    ...stats,
    // Goal-kicking accuracy. Null rather than 0 when nobody has recorded a
    // kick either way, so "no data" doesn't read as "missed everything".
    conversion_attempts: stats.conversions + stats.missed_conversions,
    conversion_rate:
      stats.conversions + stats.missed_conversions > 0
        ? Math.round(
            (stats.conversions / (stats.conversions + stats.missed_conversions)) * 100
          )
        : null,
    // Rugby League points: try=4, conversion=2, penalty=2, drop_goal=1
    total_points:
      stats.tries * 4 +
      stats.conversions * 2 +
      stats.penalty_goals * 2 +
      stats.drop_goals,
  };
}

// Map event_type → stat counter name
/** Events have been entered from three screens, so "penalty goal",
 *  "penalty_goal" and "penalty" all appear. Count them as one thing. */
function normaliseEventType(value: string): string {
  const t = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return t === "penalty" ? "penalty_goal" : t;
}

const EVENT_STAT_MAP: Record<string, string> = {
  try: "tries",
  conversion: "conversions",
  missed_conversion: "missed_conversions",
  penalty_goal: "penalty_goals",
  drop_goal: "drop_goals",
  yellow_card: "yellow_cards",
  red_card: "red_cards",
  tackle_break: "tackle_breaks",
  offload: "offloads",
  clean_break: "clean_breaks",
  tackle: "tackles",
  missed_tackle: "missed_tackles",
  turnover_won: "turnovers_won",
};

function aggregateStats(events: { event_type: string }[]) {
  const stats: Record<string, number> = {};
  for (const ev of events) {
    const key = EVENT_STAT_MAP[normaliseEventType(ev.event_type)];
    if (key) stats[key] = (stats[key] ?? 0) + 1;
  }
  // Ensure all keys exist even if zero
  for (const key of Object.values(EVENT_STAT_MAP)) {
    if (!(key in stats)) stats[key] = 0;
  }
  return stats;
}
