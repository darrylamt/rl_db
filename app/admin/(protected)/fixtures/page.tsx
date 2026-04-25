import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteFixture } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);

  // Seasons + competition-id lookup (for the year filter).
  const { data: allComps } = await supabase
    .from("competitions")
    .select("competition_id, season");
  const seasons = Array.from(
    new Set(
      (allComps ?? [])
        .map((c: any) => c.season)
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const rawYear = first(searchParams?.year);
  const currentYear = String(new Date().getFullYear());
  const selectedYear =
    rawYear === "all"
      ? ""
      : rawYear && seasons.includes(rawYear)
      ? rawYear
      : seasons.includes(currentYear)
      ? currentYear
      : "";

  const compIdsInYear = selectedYear
    ? (allComps ?? [])
        .filter((c: any) => c.season === selectedYear)
        .map((c: any) => c.competition_id as string)
    : [];

  let q = supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name, season)",
      { count: "exact" }
    );

  if (selectedYear) {
    if (compIdsInYear.length > 0) q = q.in("competition_id", compIdsInYear);
    else q = q.eq("fixture_id", "00000000-0000-0000-0000-000000000000"); // empty
  }

  const { data: fixtures, error, count } = await q
    .order("scheduled_date", { ascending: true })
    .range(from, to);

  const nonDefaultYear =
    rawYear === "all" || (selectedYear && selectedYear !== currentYear);

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["fixtures", "match_results"]} />
      <ListHeader title="Fixtures" addHref="/admin/fixtures/new" addLabel="Add Fixture" />

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
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
        >
          Apply
        </button>
        {nonDefaultYear && (
          <Link href="/admin/fixtures" className="text-xs text-slate-500 hover:underline">
            reset
          </Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-3 py-2.5 font-medium">Match</th>
              <th className="hidden sm:table-cell px-3 py-2.5 font-medium">Date</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Competition</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Venue</th>
              <th className="hidden lg:table-cell px-3 py-2.5 font-medium">Round</th>
              <th className="hidden sm:table-cell px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(fixtures ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {selectedYear ? `No fixtures in ${selectedYear}.` : "No fixtures yet."}{" "}
                  {!selectedYear && <Link href="/admin/fixtures/new" className="text-navy-700 hover:underline">Add the first one →</Link>}
                </td>
              </tr>
            ) : (
              (fixtures ?? []).map((f: any) => (
                <tr key={f.fixture_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-navy-900">
                    {f.home?.name ?? "?"} <span className="text-slate-400 font-normal">vs</span> {f.away?.name ?? "?"}
                    {/* Mobile: date + status + competition below match */}
                    <div className="sm:hidden mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{fmt(f.scheduled_date)}{f.scheduled_time ? ` ${f.scheduled_time.slice(0,5)}` : ""}</span>
                      {f.competition?.name && <span>· {f.competition.name}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        f.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        f.status === "live" ? "bg-red-50 text-red-700" : "bg-navy-50 text-navy-700"
                      }`}>{f.status ?? "—"}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {fmt(f.scheduled_date)}
                    {f.scheduled_time && <span className="block text-xs text-slate-400">{f.scheduled_time.slice(0,5)}</span>}
                  </td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">
                    {f.competition?.name ?? "—"}
                    {f.competition?.season && <span className="text-slate-400"> · {f.competition.season}</span>}
                  </td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">{f.venue?.name ?? "—"}</td>
                  <td className="hidden lg:table-cell px-3 py-2.5 text-slate-600">{f.round ?? "—"}</td>
                  <td className="hidden sm:table-cell px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      f.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      f.status === "live" ? "bg-red-50 text-red-700" :
                      f.status === "scheduled" ? "bg-navy-50 text-navy-700" : "bg-slate-100 text-slate-600"
                    }`}>{f.status ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {/* Mobile: primary action */}
                    <div className="sm:hidden flex items-center justify-end gap-1.5">
                      <Link href={`/admin/fixtures/${f.fixture_id}/lineup`} className="bg-emerald-700 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-emerald-800">Lineup</Link>
                      <Link href={`/admin/results/${f.fixture_id}`} className="bg-gold-600 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-gold-700">Result</Link>
                    </div>
                    {/* Desktop: all actions */}
                    <span className="hidden sm:inline-flex items-center gap-2">
                      <Link href={`/admin/fixtures/${f.fixture_id}/lineup`} className="text-emerald-700 hover:underline text-sm">Lineup</Link>
                      <Link href={`/admin/results/${f.fixture_id}`} className="text-gold-700 hover:underline text-sm">Result</Link>
                      <Link href={`/admin/fixtures/${f.fixture_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                      <DeleteRowButton id={f.fixture_id} action={deleteFixture} />
                    </span>
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
