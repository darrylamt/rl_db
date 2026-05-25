import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/competitions
// GET /api/competitions?season=2025
// GET /api/competitions?status=active|upcoming|completed
// GET /api/competitions?limit=50&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const season = url.searchParams.get("season");
  const status = url.searchParams.get("status");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("competitions")
    .select(
      "competition_id, name, season, type, start_date, end_date, status",
      { count: "exact" }
    )
    .order("season", { ascending: false })
    .order("name")
    .range(from, to);

  if (season) q = q.eq("season", season);
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
  if (!body.name) return fail("`name` is required");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("competitions")
    .insert({
      name: body.name,
      season: body.season ?? null,
      type: body.type ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      status: body.status ?? "upcoming",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201, cache: "none" });
}
