import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/fixtures
// GET /api/fixtures?competition=<uuid>
// GET /api/fixtures?team=<uuid>
// GET /api/fixtures?status=scheduled|completed|live|postponed|cancelled
// GET /api/fixtures?season=2025
// GET /api/fixtures?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");
  const teamId = url.searchParams.get("team");
  const status = url.searchParams.get("status");
  const season = url.searchParams.get("season");
  const { from, to } = parsePagination(url);

  // If season filter is requested, resolve to competition IDs first
  let compIds: string[] | null = null;
  if (season) {
    const { data: comps } = await supabase
      .from("competitions")
      .select("competition_id")
      .eq("season", season);
    compIds = (comps ?? []).map((c: any) => c.competition_id as string);
  }

  let q = supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home_team:home_team_id(team_id, name), away_team:away_team_id(team_id, name), venue:venue_id(name), competition:competition_id(competition_id, name, season)",
      { count: "exact" }
    )
    .order("scheduled_date", { ascending: true })
    .range(from, to);

  if (competitionId) q = q.eq("competition_id", competitionId);
  if (status) q = q.eq("status", status);
  if (teamId) q = q.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  if (compIds !== null) {
    if (compIds.length === 0) q = q.eq("fixture_id", "00000000-0000-0000-0000-000000000000");
    else q = q.in("competition_id", compIds);
  }

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.home_team_id || !body.away_team_id) {
    return fail("`home_team_id` and `away_team_id` are required");
  }
  if (body.home_team_id === body.away_team_id) {
    return fail("Home and away team must be different");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fixtures")
    .insert({
      competition_id: body.competition_id ?? null,
      home_team_id: body.home_team_id,
      away_team_id: body.away_team_id,
      venue_id: body.venue_id ?? null,
      scheduled_date: body.scheduled_date ?? null,
      scheduled_time: body.scheduled_time ?? null,
      round: body.round ?? null,
      status: body.status ?? "scheduled",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
