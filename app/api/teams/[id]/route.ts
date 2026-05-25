import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/teams/:id
// Returns the team profile, their current players, and recent results.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createPublicClient();
  const { id } = params;

  const [
    { data: team, error: teamError },
    { data: players },
    { data: recentFixtures },
  ] = await Promise.all([
    // Team profile
    supabase
      .from("teams")
      .select(
        "team_id, name, team_type, region, city, logo_url, founded_year, manager_name, coach_name, home_venue:home_venue_id(venue_id, name, city)"
      )
      .eq("team_id", id)
      .maybeSingle(),

    // Active players on the team
    supabase
      .from("public_players")
      .select(
        "player_id, first_name, last_name, jersey_number, position, is_captain, playing_status, photo_url"
      )
      .eq("team_id", id)
      .eq("playing_status", "active")
      .order("jersey_number", { ascending: true, nullsFirst: false }),

    // 10 most recent fixtures (with results)
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, round, status, home_team:home_team_id(team_id, name), away_team:away_team_id(team_id, name), competition:competition_id(name, season), result:match_results(home_score, away_score)"
      )
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
      .order("scheduled_date", { ascending: false })
      .limit(10),
  ]);

  if (teamError) return fail(teamError.message, 500);
  if (!team) return fail("Team not found", 404);

  return ok({
    ...team,
    players: players ?? [],
    recent_fixtures: recentFixtures ?? [],
  });
}
