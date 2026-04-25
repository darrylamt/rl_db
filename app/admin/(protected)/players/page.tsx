import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deletePlayer } from "./actions";

const CURRENT_YEAR = new Date().getFullYear();

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const selectedTeam = first(searchParams?.team) || "";
  const rawYear = first(searchParams?.year);
  // "all" means no year filter; otherwise default to current year
  const selectedYear =
    rawYear === "all" ? null : rawYear ? parseInt(rawYear, 10) : CURRENT_YEAR;

  const { page, pageSize, from, to } = getPageParams(searchParams, 20);

  // Year options
  const yearOptions = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

  const teamsP = supabase.from("teams").select("team_id, name").order("name");

  // When filtering by year we join through player_registrations
  let playerIds: string[] | null = null;
  if (selectedYear) {
    let regQ = supabase
      .from("player_registrations")
      .select("player_id")
      .eq("season_year", selectedYear);
    if (selectedTeam) regQ = regQ.eq("team_id", selectedTeam);
    const { data: regs } = await regQ;
    playerIds = (regs ?? []).map((r: any) => r.player_id as string);
  }

  let query = supabase
    .from("players")
    .select(
      "player_id, first_name, last_name, jersey_number, position, is_captain, playing_status, photo_url, team:team_id(team_id, name)",
      { count: "exact" }
    )
    .order("last_name")
    .range(from, to);

  if (selectedYear && playerIds !== null) {
    if (playerIds.length === 0) {
      // No registrations: force empty result
      query = query.eq("player_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("player_id", playerIds);
    }
  } else if (!selectedYear && selectedTeam) {
    query = query.eq("team_id", selectedTeam);
  }

  const [{ data: teams }, { data: players, error, count }] = await Promise.all([
    teamsP,
    query,
  ]);

  const isFiltered = selectedYear || selectedTeam;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["players", "player_registrations"]} />
      <ListHeader title="Players" addHref="/admin/players/new" addLabel="Add Player" />

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Season Year</span>
          <select
            name="year"
            defaultValue={rawYear === "all" ? "all" : (selectedYear ?? CURRENT_YEAR)}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[8rem]"
          >
            <option value="all">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Team</span>
          <select
            name="team"
            defaultValue={selectedTeam}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[10rem]"
          >
            <option value="">All teams</option>
            {(teams ?? []).map((t: any) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Filter
        </button>
        {isFiltered && (
          <Link href="/admin/players" className="text-xs text-slate-500 hover:underline">
            clear
          </Link>
        )}
      </form>

      {selectedYear && (
        <p className="text-xs text-slate-500 mb-3">
          Showing players registered for <span className="font-semibold">{selectedYear}</span>.{" "}
          <Link href={`/admin/registrations?year=${selectedYear}`} className="text-navy-700 hover:underline">
            Manage registrations →
          </Link>
        </p>
      )}

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
                  {selectedYear
                    ? `No players registered for ${selectedYear}.`
                    : "No players yet."}{" "}
                  {selectedYear ? (
                    <Link href={`/admin/registrations?year=${selectedYear}`} className="text-navy-700 hover:underline">
                      Register players →
                    </Link>
                  ) : (
                    <Link href="/admin/players/new" className="text-navy-700 hover:underline">
                      Add the first one →
                    </Link>
                  )}
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
                    <Link href={`/admin/players/${p.player_id}/view`} className="hover:underline">
                      {p.first_name} {p.last_name}
                    </Link>
                    {p.is_captain && (
                      <span className="ml-2 bg-gold-100 text-gold-800 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Capt
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {p.team?.team_id ? (
                      <Link href={`/admin/teams/${p.team.team_id}/view`} className="hover:underline">
                        {p.team.name}
                      </Link>
                    ) : "—"}
                  </td>
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
