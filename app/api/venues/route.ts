import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/venues
// GET /api/venues?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const { from, to } = parsePagination(url);

  const { data, error, count } = await supabase
    .from("venues")
    .select("venue_id, name, region, city, capacity", { count: "exact" })
    .order("name")
    .range(from, to);

  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name) return fail("`name` is required");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: body.name,
      region: body.region ?? null,
      city: body.city ?? null,
      capacity: body.capacity ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
