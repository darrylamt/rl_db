import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { getPageParams } from "@/lib/pagination";
import { Pagination } from "@/components/admin/Pagination";
import { deleteArticle } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const STATUS_OPTS = ["all", "draft", "published", "archived"] as const;

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 15);
  const q = (first(searchParams?.q) ?? "").trim();
  const rawStatus = first(searchParams?.status) ?? "all";
  const filterStatus = STATUS_OPTS.includes(rawStatus as any) ? rawStatus : "all";

  let query = supabase
    .from("articles")
    .select("article_id, title, slug, excerpt, status, author, tags, published_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filterStatus !== "all") query = query.eq("status", filterStatus);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: articles, count } = await query;

  const statusColor: Record<string, string> = {
    draft:     "bg-slate-100 text-slate-600",
    published: "bg-emerald-100 text-emerald-700",
    archived:  "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-4 md:p-8">
      <header className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <p className="text-gold-600 font-display tracking-widest text-xs">ADMIN</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">Articles</h1>
        </div>
        <Link
          href="/admin/articles/new"
          className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 rounded font-medium text-sm whitespace-nowrap"
        >
          + New Article
        </Link>
      </header>

      {/* Filters */}
      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Article title…"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Status</span>
          <select
            name="status"
            defaultValue={filterStatus}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[9rem]"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Filter
        </button>
        {(q || filterStatus !== "all") && (
          <Link href="/admin/articles" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {(articles ?? []).length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            {q || filterStatus !== "all" ? "No articles match the filters." : "No articles yet."}{" "}
            <Link href="/admin/articles/new" className="text-navy-700 hover:underline">Write the first one →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(articles ?? []).map((a: any) => (
              <li key={a.article_id} className="flex items-start gap-4 px-4 py-4 hover:bg-slate-50 group">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <Link
                      href={`/admin/articles/${a.article_id}`}
                      className="font-semibold text-navy-900 hover:underline text-sm leading-snug"
                    >
                      {a.title || <span className="text-slate-400 italic">Untitled</span>}
                    </Link>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize shrink-0 ${statusColor[a.status] ?? statusColor.draft}`}>
                      {a.status}
                    </span>
                  </div>

                  {a.excerpt && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.excerpt}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                    {a.author && <span>{a.author}</span>}
                    <span>
                      {a.status === "published" && a.published_at
                        ? `Published ${fmt(a.published_at)}`
                        : `Updated ${fmt(a.updated_at)}`}
                    </span>
                    {a.slug && <span className="font-mono">/{a.slug}</span>}
                    {(a.tags ?? []).length > 0 && (
                      <span className="flex gap-1">
                        {(a.tags as string[]).slice(0, 3).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t}</span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <Link
                    href={`/admin/articles/${a.article_id}`}
                    className="text-navy-700 hover:underline text-sm"
                  >
                    Edit
                  </Link>
                  <DeleteRowButton id={a.article_id} action={deleteArticle} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}
