import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deletePlayer } from "./actions";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: { team?: string; page?: string };
}) {
  const supabase = createAdminClient();
  const selectedTeam = searchParams.team || "";
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);

  const teamsP = supabase.from("teams").select("team_id, name").order("name");

  let query = supabase
    .from("players")
    .select(
      "player_id, first_name, last_name, jersey_number, position, is_captain, playing_status, photo_url, team:team_id(name)",
      { count: "exact" }
    )
    .order("last_name")
    .range(from, to);
  if (selectedTeam) query = query.eq("team_id", selectedTeam);

  const [{ data: teams }, { data: players, error, count }] = await Promise.all([
    teamsP,
    query,
  ]);

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["players"]} />
      <ListHeader title="Players" addHref="/admin/players/new" addLabel="Add Player" />

      <form className="mb-4 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">Team</span>
        <select
          name="team"
          defaultValue={selectedTeam}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900"
        >
          <option value="">All teams</option>
          {(teams ?? []).map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Filter
        </button>
        {selectedTeam && (
          <Link href="/admin/players" className="text-xs text-slate-500 hover:underline">clear</Link>
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
              <th className="px-4 py-2.5 font-medium"></th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Position</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(players ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No players yet.{" "}
                  <Link href="/admin/players/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (players ?? []).map((p: any) => (
                <tr key={p.player_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {p.first_name} {p.last_name}
                    {p.is_captain && (
                      <span className="ml-2 bg-gold-100 text-gold-800 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Capt
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.team?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.jersey_number ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.position ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.playing_status === "active" ? "bg-emerald-50 text-emerald-700" :
                      p.playing_status === "injured" ? "bg-amber-50 text-amber-700" :
                      p.playing_status === "retired" ? "bg-slate-100 text-slate-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {p.playing_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/players/${p.player_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={p.player_id} action={deletePlayer} />
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
