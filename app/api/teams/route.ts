import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "team_id, name, region, city, logo_url, founded_year, manager_name, coach_name, home_venue:home_venue_id(name)"
    )
    .order("name");
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name || typeof body.name !== "string") {
    return fail("`name` is required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: body.name,
      region: body.region ?? null,
      city: body.city ?? null,
      logo_url: body.logo_url ?? null,
      founded_year: body.founded_year ?? null,
      home_venue_id: body.home_venue_id ?? null,
      manager_name: body.manager_name ?? null,
      coach_name: body.coach_name ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
