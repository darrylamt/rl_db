import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteCompetition } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);
  const { data: comps, error, count } = await supabase
    .from("competitions")
    .select(
      "competition_id, name, season, type, status, start_date, end_date",
      { count: "exact" }
    )
    .order("start_date", { ascending: false })
    .range(from, to);

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["competitions"]} />
      <ListHeader title="Competitions" addHref="/admin/competitions/new" addLabel="Add Competition" />

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
              <th className="px-4 py-2.5 font-medium">Season</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Start</th>
              <th className="px-4 py-2.5 font-medium">End</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(comps ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No competitions yet.{" "}
                  <Link href="/admin/competitions/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (comps ?? []).map((c: any) => (
                <tr key={c.competition_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.season ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.type ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === "active" ? "bg-emerald-50 text-emerald-700" :
                      c.status === "completed" ? "bg-slate-100 text-slate-600" :
                      c.status === "upcoming" ? "bg-navy-50 text-navy-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {c.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{fmt(c.start_date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmt(c.end_date)}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/competitions/${c.competition_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={c.competition_id} action={deleteCompetition} />
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
