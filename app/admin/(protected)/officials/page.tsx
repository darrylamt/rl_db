import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteOfficial } from "./actions";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OfficialsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);
  const q = (first(searchParams?.q) ?? "").trim();

  let query = supabase
    .from("officials")
    .select("official_id, first_name, last_name, role, region, status, photo_url", { count: "exact" })
    .order("last_name")
    .range(from, to);

  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

  const { data: officials, error, count } = await query;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["officials"]} />
      <ListHeader title="Officials" addHref="/admin/officials/new" addLabel="Add Official" />

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Name…"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Search
        </button>
        {q && (
          <Link href="/admin/officials" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {error && <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">{error.message}</div>}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-3 py-2.5 font-medium w-10"></th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Role</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Region</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(officials ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No officials yet.{" "}
                  <Link href="/admin/officials/new" className="text-navy-700 hover:underline">Add the first one →</Link>
                </td>
              </tr>
            ) : (
              (officials ?? []).map((o: any) => (
                <tr key={o.official_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 w-10">
                    {o.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.photo_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-500 text-xs font-medium flex items-center justify-center">
                        {o.first_name?.[0]}{o.last_name?.[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-navy-900">
                    {o.first_name} {o.last_name}
                    <div className="md:hidden mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {o.role && <span>{o.role}</span>}
                      {o.status && (
                        <span className={`px-1.5 py-0.5 rounded-full ${o.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {o.status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">{o.role ?? "—"}</td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">{o.region ?? "—"}</td>
                  <td className="hidden md:table-cell px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {o.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="hidden md:inline-flex items-center gap-3">
                      <Link href={`/admin/officials/${o.official_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                      <DeleteRowButton id={o.official_id} action={deleteOfficial} />
                    </span>
                    <Link href={`/admin/officials/${o.official_id}`} className="md:hidden inline-block bg-navy-900 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-navy-700">
                      Edit
                    </Link>
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
