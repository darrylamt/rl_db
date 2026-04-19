import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/events?fixture=<uuid>     — match events for one fixture (chrono)
// GET /api/events?player=<uuid>      — events for one player across fixtures
export async function GET(req: Request) {
  const supabase = createClient();
  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixture");
  const playerId = url.searchParams.get("player");

  if (!fixtureId && !playerId) {
    return fail("Provide `fixture` or `player` query param");
  }

  let q = supabase
    .from("match_events")
    .select(
      "event_id, event_type, minute, half, notes, created_at, fixture_id, player:player_id(player_id, first_name, last_name), team:team_id(team_id, name)"
    )
    .order("minute", { ascending: true });

  if (fixtureId) q = q.eq("fixture_id", fixtureId);
  if (playerId) q = q.eq("player_id", playerId);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.fixture_id || !body.player_id || !body.event_type) {
    return fail("`fixture_id`, `player_id`, `event_type` are required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("match_events")
    .insert({
      fixture_id: body.fixture_id,
      player_id: body.player_id,
      team_id: body.team_id ?? null,
      event_type: body.event_type,
      minute: body.minute ?? null,
      half: body.half ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
