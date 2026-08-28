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
      "article_id, title, slug, excerpt, cover_image_url, category, author, tags, status, published_at, updated_at",
      { count: "exact" }
    )
    .eq("status", "published")   // RLS also enforces this; belt+braces
    .order("published_at", { ascending: false })
    .range(from, to);

  if (tag) q = q.contains("tags", [tag]);

  const { data, error, count } = await q;
  if (error) return fail(error.message, 500);
  // Mirrored under the names the public site's news cards already use.
  const items = (data ?? []).map((a: any) => ({
    ...a,
    poster: a.cover_image_url,
    teaser: a.excerpt,
    main_category: a.category,
    date: a.published_at,
  }));

  return ok({ items, total: count ?? 0 }, { cache: "short" });
}
