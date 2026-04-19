import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteFixture } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function FixturesPage() {
  const supabase = createAdminClient();
  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name, season)"
    )
    .order("scheduled_date", { ascending: false });

  return (
    <div className="p-8">
      <LiveRefresh tables={["fixtures", "match_results"]} />
      <ListHeader title="Fixtures" addHref="/admin/fixtures/new" addLabel="Add Fixture" />

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
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Match</th>
              <th className="px-4 py-2.5 font-medium">Venue</th>
              <th className="px-4 py-2.5 font-medium">Competition</th>
              <th className="px-4 py-2.5 font-medium">Round</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(fixtures ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No fixtures yet.{" "}
                  <Link href="/admin/fixtures/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (fixtures ?? []).map((f: any) => (
                <tr key={f.fixture_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{fmt(f.scheduled_date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.scheduled_time?.slice(0,5) ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {f.home?.name ?? "?"} <span className="text-slate-400">vs</span> {f.away?.name ?? "?"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{f.venue?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {f.competition?.name ?? "—"}
                    {f.competition?.season && <span className="text-slate-400"> · {f.competition.season}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{f.round ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      f.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      f.status === "live" ? "bg-red-50 text-red-700" :
                      f.status === "scheduled" ? "bg-navy-50 text-navy-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {f.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/results/${f.fixture_id}`} className="text-gold-700 hover:underline text-sm">Result</Link>
                    <Link href={`/admin/fixtures/${f.fixture_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={f.fixture_id} action={deleteFixture} />
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
