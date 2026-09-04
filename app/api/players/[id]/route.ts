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

  // "*" keeps this resilient to the view gaining columns, so the two that
  // must not go out are taken back off here rather than by enumerating every
  // other column and having to remember this file each time one is added.
  const { date_of_birth, age, ...publicPlayer } = player as any;

  return ok({
    ...publicPlayer,
    stats: {
      matches_played: matchesPlayed,
      ...stats,
      // Rugby League points: try=4, conversion=2, penalty=2, drop_goal=1
      // Goal-kicking accuracy. Null rather than 0 when nobody has recorded a
      // kick either way, so "no data" doesn't read as "missed everything".
      conversion_attempts: stats.conversions + stats.missed_conversions,
      conversion_rate:
        stats.conversions + stats.missed_conversions > 0
          ? Math.round(
              (stats.conversions / (stats.conversions + stats.missed_conversions)) * 100
            )
          : null,
      total_points:
        stats.tries * 4 +
        stats.conversions * 2 +
        stats.penalty_goals * 2 +
        stats.drop_goals,
    },
  });
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
