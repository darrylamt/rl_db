import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/results
// GET /api/results?competition=<uuid>
// GET /api/results?team=<uuid>
// GET /api/results?season=2025
// GET /api/results?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");
  const teamId = url.searchParams.get("team");
  const season = url.searchParams.get("season");
  const { from, to } = parsePagination(url);

  // Resolve season → fixture IDs
  let seasonFixtureIds: string[] | null = null;
  if (season) {
    const { data: comps } = await supabase
      .from("competitions")
      .select("competition_id")
      .eq("season", season);
    const compIds = (comps ?? []).map((c: any) => c.competition_id as string);
    if (compIds.length === 0) {
      seasonFixtureIds = [];
    } else {
      const { data: fx } = await supabase
        .from("fixtures")
        .select("fixture_id")
        .in("competition_id", compIds);
      seasonFixtureIds = (fx ?? []).map((f: any) => f.fixture_id as string);
    }
  }

  // Resolve team → fixture IDs
  let teamFixtureIds: string[] | null = null;
  if (teamId) {
    const { data: fx } = await supabase
      .from("fixtures")
      .select("fixture_id")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    teamFixtureIds = (fx ?? []).map((f: any) => f.fixture_id as string);
  }

  // Intersect filters
  const allSets = [seasonFixtureIds, teamFixtureIds].filter(
    (s): s is string[] => s !== null
  );
  let filteredFixtureIds: string[] | null = null;
  if (allSets.length > 0) {
    filteredFixtureIds = allSets.reduce((acc, set) => {
      const s = new Set(set);
      return acc.filter((id) => s.has(id));
    });
  }

  let q = supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals, attendance, recorded_at, fixture:fixture_id!inner(fixture_id, scheduled_date, round, home_team:home_team_id(team_id, name), away_team:away_team_id(team_id, name), competition:competition_id(competition_id, name, season))",
      { count: "exact" }
    )
    .order("recorded_at", { ascending: false })
    .range(from, to);

  if (competitionId) q = q.eq("fixture.competition_id", competitionId);

  if (filteredFixtureIds !== null) {
    if (filteredFixtureIds.length === 0) {
      q = q.eq("result_id", "00000000-0000-0000-0000-000000000000");
    } else {
      q = q.in("fixture_id", filteredFixtureIds);
    }
  }

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 }, { cache: "short" });
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

  return ok(data, { status: 201, cache: "none" });
}
