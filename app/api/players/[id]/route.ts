import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { fetchLineupAppearances } from "@/lib/appearances";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/players/:id
// Returns the player profile plus career stats aggregated from match_events.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createPublicClient();
  const { id } = params;

  const [{ data: player, error: playerError }, { data: events }, lineups] =
    await Promise.all([
      supabase
        .from("public_players")
        // public_players already excludes phone/email, so "*" is safe here and
        // keeps working before/after the attribute columns are added.
        .select("*")
        .eq("player_id", id)
        .maybeSingle(),

      // All scoring/discipline events for the player — used to build stats
      supabase
        .from("match_events")
        .select("event_type, fixture_id")
        .eq("player_id", id),

      // Squad selections — a player appears in a match even with no events
      fetchLineupAppearances(supabase, id),
    ]);

  if (playerError) return fail(playerError.message, 500);
  if (!player) return fail("Player not found", 404);

  // Aggregate career stats from raw events
  const stats = aggregateStats(events ?? []);

  // Distinct fixtures the player was selected for or recorded an event in
  const playedFixtureIds = new Set<string>(
    (events ?? []).map((e: any) => e.fixture_id).filter(Boolean)
  );
  for (const l of lineups) {
    if (l.fixture?.fixture_id) playedFixtureIds.add(l.fixture.fixture_id);
  }
  const matchesPlayed = playedFixtureIds.size;

  return ok({
    ...player,
    stats: {
      matches_played: matchesPlayed,
      ...stats,
      // Rugby League points: try=4, conversion=2, penalty=2, drop_goal=1
      total_points:
        stats.tries * 4 +
        stats.conversions * 2 +
        stats.penalty_goals * 2 +
        stats.drop_goals,
    },
  });
}

// Map event_type → stat counter name
const EVENT_STAT_MAP: Record<string, string> = {
  try: "tries",
  conversion: "conversions",
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
    const key = EVENT_STAT_MAP[ev.event_type];
    if (key) stats[key] = (stats[key] ?? 0) + 1;
  }
  // Ensure all keys exist even if zero
  for (const key of Object.values(EVENT_STAT_MAP)) {
    if (!(key in stats)) stats[key] = 0;
  }
  return stats;
}
