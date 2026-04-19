import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/results
// GET /api/results?competition=<uuid>
// GET /api/results?team=<uuid>
export async function GET(req: Request) {
  const supabase = createClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");
  const teamId = url.searchParams.get("team");

  // We select match_results nested with fixture; filters reach through the
  // nested fixture join via pgrst's filter syntax.
  let q = supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals, attendance, recorded_by, recorded_at, fixture:fixture_id!inner(fixture_id, scheduled_date, home_team:home_team_id(team_id, name), away_team:away_team_id(team_id, name), competition:competition_id(competition_id, name, season))"
    )
    .or("home_score.gt.0,away_score.gt.0")
    .order("recorded_at", { ascending: false });

  if (competitionId) {
    q = q.eq("fixture.competition_id", competitionId);
  }
  if (teamId) {
    q = q.or(
      `home_team_id.eq.${teamId},away_team_id.eq.${teamId}`,
      { foreignTable: "fixture" }
    );
  }

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.fixture_id) return fail("`fixture_id` is required");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("match_results")
    .upsert(
      {
        fixture_id: body.fixture_id,
        home_score: body.home_score ?? 0,
        away_score: body.away_score ?? 0,
        home_tries: body.home_tries ?? 0,
        away_tries: body.away_tries ?? 0,
        home_conversions: body.home_conversions ?? 0,
        away_conversions: body.away_conversions ?? 0,
        home_penalties: body.home_penalties ?? 0,
        away_penalties: body.away_penalties ?? 0,
        home_drop_goals: body.home_drop_goals ?? 0,
        away_drop_goals: body.away_drop_goals ?? 0,
        attendance: body.attendance ?? null,
        recorded_by: body.recorded_by ?? null,
      },
      { onConflict: "fixture_id" }
    )
    .select()
    .single();

  if (error) return fail(error.message, 500);

  // Mark fixture completed
  await supabase
    .from("fixtures")
    .update({ status: "completed" })
    .eq("fixture_id", body.fixture_id);

  return ok(data, { status: 201 });
}
