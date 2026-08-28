import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { htmlToBlocks } from "@/lib/articleBlocks";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/articles/:slug  — full article content by slug
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data)  return fail("Article not found", 404);

  // Imported articles carry their original typed blocks, which express
  // galleries and attributed quotes that Tiptap HTML cannot. Those win.
  // Anything written in the admin is converted from its HTML instead.
  const stored = Array.isArray(data.blocks) ? data.blocks : null;

  return ok(
    {
      ...data,
      // Field names the public site already renders.
      poster: data.cover_image_url,
      teaser: data.excerpt,
      main_category: data.category,
      date: data.published_at,
      blocks: stored && stored.length ? stored : htmlToBlocks(data.content),
    },
    { cache: "short" }
  );
}
