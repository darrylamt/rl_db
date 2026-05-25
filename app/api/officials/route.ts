import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/officials
// GET /api/officials?status=active|inactive
// GET /api/officials?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("public_officials")
    .select(
      "official_id, first_name, last_name, role, region, nationality, date_of_birth, age, photo_url, status",
      { count: "exact" }
    )
    .order("last_name")
    .range(from, to);

  if (status) q = q.eq("status", status);

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
    .from("officials")
    .insert({
      first_name: body.first_name,
      last_name: body.last_name,
      role: body.role ?? null,
      region: body.region ?? null,
      nationality: body.nationality ?? null,
      date_of_birth: body.date_of_birth ?? null,
      photo_url: body.photo_url ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      status: body.status ?? "active",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
