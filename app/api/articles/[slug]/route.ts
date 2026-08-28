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
    .select("article_id, title, slug, excerpt, content, cover_image_url, author, tags, published_at, updated_at")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data)  return fail("Article not found", 404);

  // `content` stays the source of truth (Tiptap HTML); `blocks` is the same
  // article shaped for the public site's BlockRenderer. Both are returned so
  // either consumer works without a second request.
  return ok(
    { ...data, poster: data.cover_image_url, blocks: htmlToBlocks(data.content) },
    { cache: "short" }
  );
}
