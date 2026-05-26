"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Slug helper ────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueSlug(supabase: any, base: string, excludeId?: string): Promise<string> {
  if (!base) base = "article";
  let slug = base;
  let n = 0;
  while (true) {
    let q = supabase.from("articles").select("article_id").eq("slug", slug);
    if (excludeId) q = q.neq("article_id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    n++;
    slug = `${base}-${n}`;
  }
}

// ── Create (blank draft — called when opening /articles/new) ────────────────

export async function createArticle(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("articles")
    .insert({ title: "", content: "", status: "draft" })
    .select("article_id")
    .single();
  if (error) throw new Error(error.message);
  return data.article_id;
}

// ── Save (auto-save + manual save) ─────────────────────────────────────────

export async function saveArticle(
  article_id: string,
  payload: {
    title: string;
    content: string;
    excerpt: string | null;
    cover_image_url: string | null;
    author: string | null;
    tags: string[];
  }
) {
  const supabase = createAdminClient();

  // Re-generate slug only when title changed and no slug yet
  const { data: existing } = await supabase
    .from("articles")
    .select("slug, title")
    .eq("article_id", article_id)
    .maybeSingle();

  let slug = existing?.slug;
  if (!slug && payload.title.trim()) {
    slug = await uniqueSlug(supabase, toSlug(payload.title), article_id);
  }

  const { error } = await supabase
    .from("articles")
    .update({ ...payload, slug })
    .eq("article_id", article_id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${article_id}`);
  revalidatePath("/api/articles");
}

// ── Publish / Unpublish / Archive ────────────────────────────────────────────

export async function setArticleStatus(
  article_id: string,
  status: "draft" | "published" | "archived"
) {
  const supabase = createAdminClient();

  // When publishing, also set published_at if not already set
  const extra: any = {};
  if (status === "published") {
    const { data } = await supabase
      .from("articles")
      .select("published_at, title, slug")
      .eq("article_id", article_id)
      .maybeSingle();
    if (!data?.published_at) extra.published_at = new Date().toISOString();
    // Ensure slug exists
    if (!data?.slug && data?.title) {
      extra.slug = await uniqueSlug(supabase, toSlug(data.title), article_id);
    }
  }

  const { error } = await supabase
    .from("articles")
    .update({ status, ...extra })
    .eq("article_id", article_id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${article_id}`);
  revalidatePath("/api/articles");
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteArticle(article_id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("article_id", article_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}
