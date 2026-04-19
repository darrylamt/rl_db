import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/players             — all public players
// GET /api/players?team=<uuid> — filtered by team
export async function GET(req: Request) {
  const supabase = createClient();
  const url = new URL(req.url);
  const teamId = url.searchParams.get("team");

  // Use the public_players view (hides phone/email, exposes age).
  let q = supabase
    .from("public_players")
    .select(
      "player_id, team_id, first_name, last_name, date_of_birth, age, height_cm, weight_kg, nationality, jersey_number, position, is_captain, playing_status, photo_url"
    )
    .order("last_name");

  if (teamId) q = q.eq("team_id", teamId);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
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
  return ok(data, { status: 201 });
}
