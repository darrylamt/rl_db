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
    .select("*")
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
