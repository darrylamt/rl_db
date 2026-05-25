import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteVenue } from "./actions";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function VenuesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);
  const q = (first(searchParams?.q) ?? "").trim();

  let query = supabase
    .from("venues")
    .select("venue_id, name, region, city, capacity", { count: "exact" })
    .order("name")
    .range(from, to);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: venues, error, count } = await query;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["venues"]} />
      <ListHeader title="Venues" addHref="/admin/venues/new" addLabel="Add Venue" />

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Venue name…"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Search
        </button>
        {q && (
          <Link href="/admin/venues" className="text-xs text-slate-500 hover:underline">clear</Link>
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
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">City</th>
              <th className="px-4 py-2.5 font-medium">Capacity</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(venues ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No venues yet.{" "}
                  <Link href="/admin/venues/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (venues ?? []).map((v: any) => (
                <tr key={v.venue_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{v.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.region ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.city ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.capacity?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/venues/${v.venue_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={v.venue_id} action={deleteVenue} />
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
