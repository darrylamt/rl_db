import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson, parsePagination } from "@/lib/api";
import { DOCUMENT_TYPES } from "@/lib/contentTypes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/documents
// GET /api/documents?type=Policies
// GET /api/documents?q=annual
// GET /api/documents?limit=50&offset=0
//
// The reports library: annual reports, AGM minutes, policies and monthly
// development reports. `types` is returned alongside the items so the site's
// filter dropdown doesn't need the list hard-coded.
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") ?? "").trim();
  const { from, to } = parsePagination(url);

  let query = supabase
    .from("documents")
    .select(
      "document_id, name, type, link, thumbnail_url, published_at, sort_order",
      { count: "exact" }
    )
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  // "All Documents" is how the site labels no filter — treat it as unfiltered.
  if (type && type !== "All Documents") query = query.eq("type", type);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error, count } = await query;
  if (error) return fail(error.message, 500);

  return ok({
    items: data ?? [],
    total: count ?? 0,
    types: DOCUMENT_TYPES,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name) return fail("`name` is required");
  if (!body.type || !DOCUMENT_TYPES.includes(body.type)) {
    return fail(`\`type\` must be one of: ${DOCUMENT_TYPES.join(", ")}`);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      name: body.name,
      type: body.type,
      link: body.link ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      published_at: body.published_at ?? null,
      sort_order: body.sort_order ?? 0,
      status: body.status ?? "published",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
