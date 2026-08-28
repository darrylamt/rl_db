import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { getPageParams } from "@/lib/pagination";
import { Pagination } from "@/components/admin/Pagination";
import { deletePerson } from "./actions";
import { PERSON_GROUPS } from "@/lib/contentTypes";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);
  const group = first(searchParams?.group) ?? "";

  let query = supabase
    .from("people")
    .select("person_id, name, role, email, photo_url, group_name, sort_order, status", {
      count: "exact",
    })
    .order("group_name")
    .order("sort_order")
    .range(from, to);

  if (group) query = query.eq("group_name", group);

  const { data: people, error, count } = await query;

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Board & Committee" addHref="/admin/people/new" addLabel="Add Person" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Governance listings on the public about and governance pages. Match referees
        live under <Link href="/admin/officials" className="text-navy-700 hover:underline">Officials</Link>.
      </p>

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Group</span>
          <select
            name="group"
            defaultValue={group}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[10rem]"
          >
            <option value="">All groups</option>
            {PERSON_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Apply
        </button>
        {group && (
          <Link href="/admin/people" className="text-xs text-slate-500 hover:underline">reset</Link>
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
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Group</th>
              <th className="hidden lg:table-cell px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(people ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No people yet.{" "}
                  <Link href="/admin/people/new" className="text-navy-700 hover:underline">
                    Add the first one
                  </Link>
                </td>
              </tr>
            ) : (
              (people ?? []).map((p: any) => (
                <tr key={p.person_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    <span className="flex items-center gap-2">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover bg-slate-100" />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                          {(p.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      {p.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.role ?? "\u2014"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{p.group_name}</td>
                  <td className="hidden lg:table-cell px-4 py-2.5 text-slate-600">{p.email ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/people/${p.person_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={p.person_id} action={deletePerson} />
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
