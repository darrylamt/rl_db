import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/fixtures/:id
// Returns a single fixture with its result, match events, and lineup.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createPublicClient();
  const { id } = params;

  const [
    { data: fixture, error: fixtureError },
    { data: result },
    { data: events },
    { data: lineup },
    { data: officials },
  ] = await Promise.all([
    // Core fixture
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, scheduled_time, round, status, home_team:home_team_id(team_id, name, logo_url), away_team:away_team_id(team_id, name, logo_url), venue:venue_id(venue_id, name, city), competition:competition_id(competition_id, name, season, type)"
      )
      .eq("fixture_id", id)
      .maybeSingle(),

    // Result (may be null if not yet played)
    supabase
      .from("match_results")
      .select(
        "result_id, home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals, attendance, recorded_at"
      )
      .eq("fixture_id", id)
      .maybeSingle(),

    // Match events in chronological order
    supabase
      .from("match_events")
      .select(
        "event_id, event_type, minute, half, notes, player:player_id(player_id, first_name, last_name, jersey_number), team:team_id(team_id, name)"
      )
      .eq("fixture_id", id)
      .order("half", { ascending: true })
      .order("minute", { ascending: true }),

    // Lineup — starters first, then subs
    supabase
      .from("match_lineups")
      .select(
        "lineup_id, jersey_number, position, is_starter, player:player_id(player_id, first_name, last_name, photo_url), team:team_id(team_id, name)"
      )
      .eq("fixture_id", id)
      .order("is_starter", { ascending: false })
      .order("jersey_number", { ascending: true, nullsFirst: false }),

    // Match officials
    supabase
      .from("fixture_officials")
      .select(
        "role, official:official_id(official_id, first_name, last_name)"
      )
      .eq("fixture_id", id),
  ]);

  if (fixtureError) return fail(fixtureError.message, 500);
  if (!fixture) return fail("Fixture not found", 404);

  return ok(
    {
      ...fixture,
      result: result ?? null,
      events: events ?? [],
      lineup: lineup ?? [],
      officials: officials ?? [],
    },
    { cache: "short" }
  );
}
