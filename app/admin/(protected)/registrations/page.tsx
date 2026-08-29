import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { registerPlayer, unregisterPlayer, bulkRegisterTeam } from "./actions";

const CURRENT_YEAR = new Date().getFullYear();

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();

  const rawYear = first(searchParams?.year);
  const selectedYear = rawYear ? parseInt(rawYear, 10) : CURRENT_YEAR;
  // A season holds well over a hundred registrations. The page already groups
  // them by club, so filtering to one club is the natural way to shorten it.
  const selectedClub = first(searchParams?.club) || "";

  // Year options: current year ± 3 years
  const yearOptions = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

  const [{ data: registrations }, { data: teams }, { data: allPlayers }] =
    await Promise.all([
      supabase
        .from("player_registrations")
        .select(
          "registration_id, season_year, notes, player:player_id(player_id, first_name, last_name, jersey_number, position), team:team_id(team_id, name)"
        )
        .eq("season_year", selectedYear)
        .order("season_year"),
      supabase.from("teams").select("team_id, name").eq("team_type", "club").order("name"),
      supabase
        .from("players")
        .select("player_id, first_name, last_name, team_id, jersey_number, position")
        .order("last_name"),
    ]);

  // Group registrations by team
  const byTeam = new Map<string, { teamName: string; rows: any[] }>();
  for (const reg of registrations ?? []) {
    const teamId = (reg.team as any)?.team_id ?? "__none__";
    const teamName = (reg.team as any)?.name ?? "Unassigned";
    if (!byTeam.has(teamId)) byTeam.set(teamId, { teamName, rows: [] });
    byTeam.get(teamId)!.rows.push(reg);
  }
  const visibleGroups = selectedClub
    ? Array.from(byTeam.entries()).filter(([id]) => id === selectedClub)
    : Array.from(byTeam.entries());
  const teamGroups = visibleGroups.sort((a, b) =>
    a[1].teamName.localeCompare(b[1].teamName)
  );

  const registeredPlayerIds = new Set(
    (registrations ?? []).map((r: any) => r.player?.player_id).filter(Boolean)
  );
  const unregisteredPlayers = (allPlayers ?? []).filter(
    (p) => !registeredPlayerIds.has(p.player_id)
  );

  const totalRegistered = (registrations ?? []).length;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["player_registrations", "players"]} />

      <div className="mb-6">
        <p className="text-gold-600 font-display tracking-widest text-xs">RLFG</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">
          Player Registrations
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {totalRegistered} player{totalRegistered !== 1 ? "s" : ""} registered for {selectedYear}
        </p>
      </div>

      {/* Year filter */}
      <form className="mb-6 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Season Year</span>
          <select
            name="year"
            defaultValue={selectedYear}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[8rem]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Club</span>
          <select
            name="club"
            defaultValue={selectedClub}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[10rem]"
          >
            <option value="">All clubs</option>
            {(teams ?? []).map((t) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Apply
        </button>
        {selectedClub && (
          <Link href={`/admin/registrations?year=${selectedYear}`} className="text-xs text-slate-500 hover:underline">
            clear
          </Link>
        )}
      </form>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: registered players grouped by team */}
        <div className="lg:col-span-2 space-y-4">
          {teamGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
              No players registered for {selectedYear} yet. Use the form →
            </div>
          ) : (
            teamGroups.map(([teamId, group]) => (
              <div key={teamId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-navy-900">
                    {group.teamName}
                    <span className="ml-2 text-slate-500 font-normal text-xs">({group.rows.length})</span>
                  </h3>
                  {teamId !== "__none__" && (
                    <Link href={`/admin/teams/${teamId}/view`} className="text-xs text-navy-700 hover:underline">
                      View team →
                    </Link>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Player</th>
                      <th className="px-3 py-2 font-medium">Position</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((reg: any) => (
                      <tr key={reg.registration_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 tabular-nums">
                          {reg.player?.jersey_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-navy-900">
                          <Link href={`/admin/players/${reg.player?.player_id}/view`} className="hover:underline">
                            {reg.player?.first_name} {reg.player?.last_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{reg.player?.position ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{reg.notes ?? ""}</td>
                        <td className="px-3 py-2 text-right">
                          <DeleteRowButton id={reg.registration_id} action={unregisterPlayer} label="Remove" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {/* Right: register a player + bulk register */}
        <div className="space-y-4">
          {/* Register single player */}
          <form
            action={registerPlayer}
            className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
          >
            <h3 className="font-display text-sm font-semibold text-navy-900">Register a Player</h3>
            <input type="hidden" name="season_year" value={selectedYear} />
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Player</label>
              <SearchableSelect
                name="player_id"
                required
                emptyLabel="— select player —"
                options={unregisteredPlayers.map((p: any) => ({
                  value: p.player_id,
                  label: `${p.first_name} ${p.last_name}`.trim(),
                  hint: [
                    p.jersey_number ? `#${p.jersey_number}` : null,
                    (teams ?? []).find((t) => t.team_id === p.team_id)?.name ?? null,
                  ].filter(Boolean).join(" · ") || undefined,
                }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">
                Register under team (optional override)
              </label>
              <SearchableSelect
                name="team_id"
                emptyLabel="— player's own team —"
                options={(teams ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Notes</label>
              <input
                name="notes"
                type="text"
                placeholder="Optional"
                className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:border-navy-700 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Register for {selectedYear}
            </button>
          </form>

          {/* Bulk register entire team */}
          <form
            action={bulkRegisterTeam}
            className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
          >
            <h3 className="font-display text-sm font-semibold text-navy-900">Bulk Register Team</h3>
            <p className="text-xs text-slate-500">Registers all players currently on a team for {selectedYear}.</p>
            <input type="hidden" name="season_year" value={selectedYear} />
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Team</label>
              <SearchableSelect
                name="team_id"
                required
                emptyLabel="— select team —"
                options={(teams ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gold-600 hover:bg-gold-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Bulk Register All Players
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
