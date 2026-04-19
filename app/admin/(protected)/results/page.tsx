import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteResult } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ResultsPage() {
  const supabase = createAdminClient();
  const { data: results, error } = await supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, attendance, recorded_at, fixture:fixture_id(fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name, season))"
    )
    .order("recorded_at", { ascending: false });

  return (
    <div className="p-8">
      <LiveRefresh tables={["match_results", "fixtures"]} />
      <ListHeader title="Results" addHref="/admin/fixtures" addLabel="Record via Fixtures" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Tip: click <span className="text-navy-700 font-medium">Edit</span> on a fixture to record/update its result, or use the public{" "}
        <Link href="/enter/result" className="text-navy-700 hover:underline">/enter/result</Link> form.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Competition</th>
              <th className="px-4 py-2.5 font-medium">Match</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Attendance</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(results ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No results yet.
                </td>
              </tr>
            ) : (
              (results ?? []).map((r: any) => (
                <tr key={r.result_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    {fmt(r.fixture?.scheduled_date)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.fixture?.competition?.name ?? "—"}
                    {r.fixture?.competition?.season && <span className="text-slate-400"> · {r.fixture.competition.season}</span>}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {r.fixture?.home?.name ?? "?"} <span className="text-slate-400">vs</span> {r.fixture?.away?.name ?? "?"}
                  </td>
                  <td className="px-4 py-2.5 font-display font-bold text-navy-900 text-base">
                    {r.home_score} – {r.away_score}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.attendance?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    {r.fixture?.fixture_id && (
                      <Link href={`/admin/results/${r.fixture.fixture_id}`} className="text-navy-700 hover:underline text-sm">
                        Edit
                      </Link>
                    )}
                    <DeleteRowButton id={r.result_id} action={deleteResult} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
