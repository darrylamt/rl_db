import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/fixtures
// GET /api/fixtures?competition=<uuid>
// GET /api/fixtures?team=<uuid>
// GET /api/fixtures?status=scheduled|completed|cancelled
export async function GET(req: Request) {
  const supabase = createClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");
  const teamId = url.searchParams.get("team");
  const status = url.searchParams.get("status");

  let q = supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home_team:home_team_id(team_id, name), away_team:away_team_id(team_id, name), venue:venue_id(name), competition:competition_id(competition_id, name, season)"
    )
    .order("scheduled_date", { ascending: false });

  if (competitionId) q = q.eq("competition_id", competitionId);
  if (status) q = q.eq("status", status);
  if (teamId) q = q.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
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
  return ok(data, { status: 201 });
}
