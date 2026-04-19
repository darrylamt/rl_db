import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { LiveRefresh } from "@/components/LiveRefresh";

export default async function StandingsPage({ searchParams }: { searchParams: { comp?: string } }) {
  const supabase = createAdminClient();
  const selected = searchParams.comp || "";

  const compsP = supabase.from("competitions").select("competition_id, name, season").order("name");

  let query = supabase
    .from("standings")
    .select("*")
    .order("league_points", { ascending: false });
  if (selected) query = query.eq("competition_id", selected);

  const [{ data: comps }, { data: rows, error }] = await Promise.all([compsP, query]);

  // Group by competition (when no filter)
  const groups = new Map<string, { name: string; rows: any[] }>();
  (rows ?? []).forEach((r: any) => {
    const key = r.competition_id ?? "none";
    if (!groups.has(key)) groups.set(key, { name: r.competition_name ?? "—", rows: [] });
    groups.get(key)!.rows.push(r);
  });

  return (
    <div className="p-8">
      <LiveRefresh tables={["match_results", "fixtures"]} />
      <ListHeader title="Standings" />

      <form className="mb-4 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">Competition</span>
        <select
          name="comp"
          defaultValue={selected}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900"
        >
          <option value="">All competitions</option>
          {(comps ?? []).map((c: any) => (
            <option key={c.competition_id} value={c.competition_id}>
              {c.name}{c.season ? ` · ${c.season}` : ""}
            </option>
          ))}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Filter
        </button>
        {selected && (
          <Link href="/admin/standings" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      {groups.size === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          No completed matches yet — standings appear once results are recorded.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([key, group]) => (
            <section key={key}>
              <h2 className="font-display text-xl font-bold text-navy-900 mb-3">{group.name}</h2>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-left">
                    <tr>
                      <th className="px-3 py-2.5 font-medium w-10">#</th>
                      <th className="px-4 py-2.5 font-medium">Team</th>
                      <th className="px-2 py-2.5 font-medium text-center">P</th>
                      <th className="px-2 py-2.5 font-medium text-center">W</th>
                      <th className="px-2 py-2.5 font-medium text-center">D</th>
                      <th className="px-2 py-2.5 font-medium text-center">L</th>
                      <th className="px-2 py-2.5 font-medium text-center">PF</th>
                      <th className="px-2 py-2.5 font-medium text-center">PA</th>
                      <th className="px-2 py-2.5 font-medium text-center">+/-</th>
                      <th className="px-2 py-2.5 font-medium text-center bg-gold-50">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((r: any, i: number) => (
                      <tr key={`${r.team_id}-${r.competition_id}`} className={i < 4 ? "bg-emerald-50/30" : ""}>
                        <td className="px-3 py-2.5 font-medium text-slate-500">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-navy-900">{r.team_name}</td>
                        <td className="px-2 py-2.5 text-center text-slate-700">{r.played}</td>
                        <td className="px-2 py-2.5 text-center text-slate-700">{r.won}</td>
                        <td className="px-2 py-2.5 text-center text-slate-700">{r.drawn}</td>
                        <td className="px-2 py-2.5 text-center text-slate-700">{r.lost}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.points_for}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{r.points_against}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600">{(r.points_for ?? 0) - (r.points_against ?? 0)}</td>
                        <td className="px-2 py-2.5 text-center font-display font-bold text-navy-900 bg-gold-50">
                          {r.league_points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
