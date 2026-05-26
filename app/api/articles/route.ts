import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/articles
// GET /api/articles?status=published (default)
// GET /api/articles?tag=match+report
// GET /api/articles?limit=10&offset=0
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("articles")
    .select(
      "article_id, title, slug, excerpt, cover_image_url, author, tags, status, published_at, updated_at",
      { count: "exact" }
    )
    .eq("status", "published")   // RLS also enforces this; belt+braces
    .order("published_at", { ascending: false })
    .range(from, to);

  if (tag) q = q.contains("tags", [tag]);

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: count ?? 0 }, { cache: "short" });
}
