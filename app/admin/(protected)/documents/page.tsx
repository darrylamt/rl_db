import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { getPageParams } from "@/lib/pagination";
import { deleteDocument, DOCUMENT_TYPES } from "./actions";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);
  const q = (first(searchParams?.q) ?? "").trim();
  const type = first(searchParams?.type) ?? "";

  let query = supabase
    .from("documents")
    .select(
      "document_id, name, type, link, thumbnail_url, sort_order, status",
      { count: "exact" }
    )
    .order("type")
    .order("sort_order")
    .range(from, to);

  if (q) query = query.ilike("name", `%${q}%`);
  if (type) query = query.eq("type", type);

  const { data: docs, error, count } = await query;

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Documents" addHref="/admin/documents/new" addLabel="Add Document" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Reports, AGM minutes and policies listed on the public documents page.
      </p>

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Document name"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Type</span>
          <select
            name="type"
            defaultValue={type}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[12rem]"
          >
            <option value="">All types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Apply
        </button>
        {(q || type) && (
          <Link href="/admin/documents" className="text-xs text-slate-500 hover:underline">reset</Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Type</th>
              <th className="hidden lg:table-cell px-4 py-2.5 font-medium">Link</th>
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(docs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No documents yet.{" "}
                  <Link href="/admin/documents/new" className="text-navy-700 hover:underline">
                    Add the first one
                  </Link>
                </td>
              </tr>
            ) : (
              (docs ?? []).map((d: any) => (
                <tr key={d.document_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {d.name}
                    {d.status !== "published" && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {d.status}
                      </span>
                    )}
                    <div className="md:hidden text-xs text-slate-500 mt-0.5">{d.type}</div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{d.type}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5">
                    {d.link ? (
                      <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-navy-700 hover:underline">
                        Open
                      </a>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-slate-600 tabular-nums">{d.sort_order}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/documents/${d.document_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={d.document_id} action={deleteDocument} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}
