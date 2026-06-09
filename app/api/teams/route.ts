import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/teams
// GET /api/teams?type=club|national|president_xv
// GET /api/teams?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("teams")
    .select(
      "team_id, name, slug, team_type, region, city, logo_url, instagram_url, founded_year, manager_name, coach_name, home_venue:home_venue_id(name)",
      { count: "exact" }
    )
    .order("name")
    .range(from, to);

  if (type) q = q.eq("team_type", type);

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 });
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
      slug: body.slug ?? null,
      team_type: body.team_type ?? "club",
      region: body.region ?? null,
      city: body.city ?? null,
      logo_url: body.logo_url ?? null,
      instagram_url: body.instagram_url ?? null,
      founded_year: body.founded_year ?? null,
      home_venue_id: body.home_venue_id ?? null,
      manager_name: body.manager_name ?? null,
      coach_name: body.coach_name ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
