import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/players
// GET /api/players?team=<uuid>
// GET /api/players?status=active|injured|retired
// GET /api/players?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const teamId = url.searchParams.get("team");
  const status = url.searchParams.get("status");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("public_players")
    .select(
      "player_id, team_id, first_name, last_name, date_of_birth, age, height_cm, weight_kg, nationality, jersey_number, position, is_captain, playing_status, photo_url",
      { count: "exact" }
    )
    .order("last_name")
    .range(from, to);

  if (teamId) q = q.eq("team_id", teamId);
  if (status) q = q.eq("playing_status", status);

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.first_name || !body.last_name) {
    return fail("`first_name` and `last_name` are required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .insert({
      team_id: body.team_id ?? null,
      first_name: body.first_name,
      last_name: body.last_name,
      date_of_birth: body.date_of_birth ?? null,
      height_cm: body.height_cm ?? null,
      weight_kg: body.weight_kg ?? null,
      nationality: body.nationality ?? null,
      jersey_number: body.jersey_number ?? null,
      position: body.position ?? null,
      is_captain: body.is_captain ?? false,
      playing_status: body.playing_status ?? "active",
      photo_url: body.photo_url ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
