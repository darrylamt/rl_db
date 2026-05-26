import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { ArticleEditor } from "./ArticleEditor";

export default async function ArticleEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  const { data: article } = await supabase
    .from("articles")
    .select("article_id, title, slug, excerpt, content, cover_image_url, author, tags, status, published_at")
    .eq("article_id", params.id)
    .maybeSingle();

  if (!article) notFound();

  return (
    <ArticleEditor
      article={{
        ...article,
        tags: article.tags ?? [],
      }}
    />
  );
}
