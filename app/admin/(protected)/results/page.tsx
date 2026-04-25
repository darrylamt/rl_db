import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteResult } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);

  // Year filter: pull distinct seasons from competitions, default to
  // current year, narrow match_results via fixture_id.
  const { data: allComps } = await supabase
    .from("competitions")
    .select("competition_id, season");
  const seasons = Array.from(
    new Set(
      (allComps ?? []).map((c: any) => c.season).filter(Boolean) as string[]
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

  let fixtureIds: string[] | null = null;
  if (selectedYear) {
    const compIds = (allComps ?? [])
      .filter((c: any) => c.season === selectedYear)
      .map((c: any) => c.competition_id as string);
    if (compIds.length === 0) {
      fixtureIds = [];
    } else {
      const { data: fixturesInYear } = await supabase
        .from("fixtures")
        .select("fixture_id")
        .in("competition_id", compIds);
      fixtureIds = (fixturesInYear ?? []).map((f: any) => f.fixture_id as string);
    }
  }

  let q = supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, attendance, recorded_at, fixture:fixture_id(fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name, season))",
      { count: "exact" }
    );

  if (fixtureIds !== null) {
    if (fixtureIds.length === 0) {
      q = q.eq("result_id", "00000000-0000-0000-0000-000000000000");
    } else {
      q = q.in("fixture_id", fixtureIds);
    }
  }

  const { data: results, error, count } = await q
    .order("recorded_at", { ascending: false })
    .range(from, to);

  const nonDefaultYear =
    rawYear === "all" || (selectedYear && selectedYear !== currentYear);

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["match_results", "fixtures"]} />
      <ListHeader title="Results" addHref="/admin/fixtures" addLabel="Record via Fixtures" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Tip: click <span className="text-navy-700 font-medium">Edit</span> on a fixture to record/update its result, or use the public{" "}
        <Link href="/enter/result" className="text-navy-700 hover:underline">/enter/result</Link> form.
      </p>

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
          <Link href="/admin/results" className="text-xs text-slate-500 hover:underline">
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
              <th className="px-3 py-2.5 font-medium">Score</th>
              <th className="hidden sm:table-cell px-3 py-2.5 font-medium">Date</th>
              <th className="hidden md:table-cell px-3 py-2.5 font-medium">Competition</th>
              <th className="hidden lg:table-cell px-3 py-2.5 font-medium">Attendance</th>
              <th className="px-3 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(results ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {selectedYear ? `No results in ${selectedYear}.` : "No results yet."}
                </td>
              </tr>
            ) : (
              (results ?? []).map((r: any) => (
                <tr key={r.result_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-navy-900">
                    {r.fixture?.home?.name ?? "?"} <span className="text-slate-400 font-normal">vs</span> {r.fixture?.away?.name ?? "?"}
                    <div className="sm:hidden mt-0.5 text-xs text-slate-500">
                      {fmt(r.fixture?.scheduled_date)}
                      {r.fixture?.competition?.name && <span> · {r.fixture.competition.name}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-display font-bold text-navy-900 text-base tabular-nums">
                    {r.home_score} – {r.away_score}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-slate-600 whitespace-nowrap">{fmt(r.fixture?.scheduled_date)}</td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">
                    {r.fixture?.competition?.name ?? "—"}
                    {r.fixture?.competition?.season && <span className="text-slate-400"> · {r.fixture.competition.season}</span>}
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2.5 text-slate-600">{r.attendance?.toLocaleString() ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {r.fixture?.fixture_id && (
                      <>
                        <Link href={`/admin/results/${r.fixture.fixture_id}`} className="md:hidden inline-block bg-navy-900 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-navy-700">Edit</Link>
                        <span className="hidden md:inline-flex items-center gap-3">
                          <Link href={`/admin/results/${r.fixture.fixture_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                          <DeleteRowButton id={r.result_id} action={deleteResult} />
                        </span>
                      </>
                    )}
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
