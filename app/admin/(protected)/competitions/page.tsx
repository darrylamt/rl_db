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

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);

  // Filter option sources — competitions is a small table, one unfiltered scan
  // is fine and avoids a second round trip for distinct values.
  const { data: allComps } = await supabase
    .from("competitions")
    .select("type, season");

  const types = Array.from(
    new Set((allComps ?? []).map((c: any) => c.type).filter(Boolean) as string[])
  ).sort();
  const seasons = Array.from(
    new Set((allComps ?? []).map((c: any) => c.season).filter(Boolean) as string[])
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const rawYear = first(searchParams?.year);
  const rawType = first(searchParams?.type);
  const currentYear = String(new Date().getFullYear());

  // Default year = current year if we have comps for it, else no filter.
  // Passing year=all explicitly disables the default.
  const selectedYear =
    rawYear === "all"
      ? ""
      : rawYear && seasons.includes(rawYear)
      ? rawYear
      : seasons.includes(currentYear)
      ? currentYear
      : "";

  const selectedType = rawType && types.includes(rawType) ? rawType : "";

  let q = supabase
    .from("competitions")
    .select(
      "competition_id, name, season, type, status, start_date, end_date",
      { count: "exact" }
    );
  if (selectedYear) q = q.eq("season", selectedYear);
  if (selectedType) q = q.eq("type", selectedType);

  const { data: comps, error, count } = await q
    .order("start_date", { ascending: false })
    .range(from, to);

  // Build hrefs for the "clear" links.
  function qs(patch: Record<string, string | null>) {
    const sp = new URLSearchParams();
    if (selectedType && !("type" in patch)) sp.set("type", selectedType);
    if (selectedYear && !("year" in patch)) sp.set("year", selectedYear);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

  const filtersActive = selectedYear !== "" || selectedType !== "";
  const nonDefaultFilters =
    (selectedYear && selectedYear !== currentYear) ||
    !!selectedType ||
    rawYear === "all";

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["competitions"]} />
      <ListHeader title="Competitions" addHref="/admin/competitions/new" addLabel="Add Competition" />

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Year
          </span>
          <select
            name="year"
            defaultValue={rawYear === "all" ? "all" : selectedYear}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[8rem]"
          >
            <option value="all">All years</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Type
          </span>
          <select
            name="type"
            defaultValue={selectedType}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[10rem]"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
        >
          Apply
        </button>
        {nonDefaultFilters && (
          <Link
            href="/admin/competitions"
            className="text-xs text-slate-500 hover:underline"
          >
            reset
          </Link>
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
                  {filtersActive
                    ? "No competitions match the current filters."
                    : "No competitions yet."}{" "}
                  {!filtersActive && (
                    <Link href="/admin/competitions/new" className="text-navy-700 hover:underline">
                      Add the first one →
                    </Link>
                  )}
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
