import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/events?fixture=<uuid>    — match events for one fixture (chrono)
// GET /api/events?player=<uuid>     — events for one player across fixtures
// GET /api/events?team=<uuid>       — events for a team
// GET /api/events?type=try|conversion|...
// GET /api/events?limit=100&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixture");
  const playerId = url.searchParams.get("player");
  const teamId = url.searchParams.get("team");
  const eventType = url.searchParams.get("type");
  const { from, to } = parsePagination(url, { limit: 100 });

  if (!fixtureId && !playerId && !teamId) {
    return fail("Provide at least one of: `fixture`, `player`, or `team` query param");
  }

  let q = supabase
    .from("match_events")
    .select(
      "event_id, fixture_id, event_type, minute, half, notes, created_at, player:player_id(player_id, first_name, last_name), team:team_id(team_id, name)",
      { count: "exact" }
    )
    .order("half", { ascending: true })
    .order("minute", { ascending: true })
    .range(from, to);

  if (fixtureId) q = q.eq("fixture_id", fixtureId);
  if (playerId) q = q.eq("player_id", playerId);
  if (teamId) q = q.eq("team_id", teamId);
  if (eventType) q = q.eq("event_type", eventType);

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 }, { cache: "short" });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.fixture_id || !body.event_type) {
    return fail("`fixture_id` and `event_type` are required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("match_events")
    .insert({
      fixture_id: body.fixture_id,
      player_id: body.player_id ?? null,
      team_id: body.team_id ?? null,
      event_type: body.event_type,
      minute: body.minute ?? null,
      half: body.half ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
