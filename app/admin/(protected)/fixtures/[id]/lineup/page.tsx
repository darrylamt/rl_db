import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { addToLineup, removeFromLineup } from "./actions";

const POSITIONS = [
  "Fullback","Wing","Centre","Stand-off","Scrum-half",
  "Prop","Hooker","Second-row","Loose forward","Utility",
];

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function LineupPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const fixtureId = params.id;

  // Fixture details
  const { data: fixture } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home_team_id, away_team_id, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season)"
    )
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (!fixture) notFound();

  const homeTeam = (fixture as any).home as { team_id: string; name: string } | null;
  const awayTeam = (fixture as any).away as { team_id: string; name: string } | null;
  const comp = (fixture as any).competition as { name: string; season: string | null } | null;
  const seasonYear = comp?.season ? parseInt(comp.season, 10) : new Date().getFullYear();

  // Current lineups for this fixture
  const { data: lineups } = await supabase
    .from("match_lineups")
    .select(
      "lineup_id, team_id, jersey_number, position, is_starter, player:player_id(player_id, first_name, last_name)"
    )
    .eq("fixture_id", fixtureId);

  const homeLineup = (lineups ?? []).filter((l: any) => l.team_id === homeTeam?.team_id);
  const awayLineup = (lineups ?? []).filter((l: any) => l.team_id === awayTeam?.team_id);
  const inLineupIds = new Set((lineups ?? []).map((l: any) => l.player?.player_id).filter(Boolean));

  // Registered players for the season year, belonging to either team
  const teamIds = [homeTeam?.team_id, awayTeam?.team_id].filter(Boolean) as string[];
  const { data: registeredPlayers } = await supabase
    .from("player_registrations")
    .select("player:player_id(player_id, first_name, last_name, jersey_number, position, team_id)")
    .eq("season_year", seasonYear)
    .in("team_id", teamIds);

  const homePlayers = (registeredPlayers ?? [])
    .map((r: any) => r.player)
    .filter((p: any) => p && p.team_id === homeTeam?.team_id && !inLineupIds.has(p.player_id));
  const awayPlayers = (registeredPlayers ?? [])
    .map((r: any) => r.player)
    .filter((p: any) => p && p.team_id === awayTeam?.team_id && !inLineupIds.has(p.player_id));

  function LineupTable({ label, teamId, lineup }: { label: string; teamId: string; lineup: any[] }) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-navy-900 uppercase tracking-wide">
            {label} <span className="text-slate-400 font-normal">({lineup.length})</span>
          </h3>
        </div>
        {lineup.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No players added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineup.map((l: any) => (
                <tr key={l.lineup_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500 tabular-nums">{l.jersey_number ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-navy-900">
                    <Link href={`/admin/players/${l.player?.player_id}/view`} className="hover:underline">
                      {l.player?.first_name} {l.player?.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{l.position ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_starter ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {l.is_starter ? "Starter" : "Sub"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteRowButton id={l.lineup_id} action={removeFromLineup} label="Remove" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function AddPlayerForm({
    teamId,
    players,
    label,
  }: {
    teamId: string;
    players: any[];
    label: string;
  }) {
    return (
      <form
        action={addToLineup}
        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
      >
        <h3 className="font-display text-sm font-semibold text-navy-900">Add to {label} Lineup</h3>
        <input type="hidden" name="fixture_id" value={fixtureId} />
        <input type="hidden" name="team_id" value={teamId} />
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Player</label>
          <select
            name="player_id"
            required
            className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:border-navy-700 focus:outline-none"
          >
            <option value="">— select registered player —</option>
            {players.map((p: any) => (
              <option key={p.player_id} value={p.player_id}>
                {p.first_name} {p.last_name}
                {p.jersey_number ? ` #${p.jersey_number}` : ""}
              </option>
            ))}
          </select>
          {players.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              All registered players for {seasonYear} are already in the lineup.{" "}
              <Link href={`/admin/registrations?year=${seasonYear}`} className="underline">
                Register more →
              </Link>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Jersey #</label>
            <input
              name="jersey_number"
              type="number"
              min={1}
              max={99}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:border-navy-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Role</label>
            <select
              name="is_starter"
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:border-navy-700 focus:outline-none"
            >
              <option value="true">Starter</option>
              <option value="false">Substitute</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">Position</label>
          <select
            name="position"
            className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:border-navy-700 focus:outline-none"
          >
            <option value="">— use player default —</option>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Add to Lineup
        </button>
      </form>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href="/admin/fixtures" className="text-slate-500 hover:underline">← Fixtures</Link>
        <span className="text-slate-300">/</span>
        <Link href={`/admin/results/${fixtureId}`} className="text-slate-500 hover:underline">Result</Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900">
          Lineup — {homeTeam?.name ?? "?"} vs {awayTeam?.name ?? "?"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {fmt(fixture.scheduled_date)}
          {fixture.scheduled_time ? ` @ ${(fixture.scheduled_time as string).slice(0, 5)}` : ""}
          {comp?.name ? ` · ${comp.name}${comp.season ? ` ${comp.season}` : ""}` : ""}
          {fixture.round ? ` · ${fixture.round}` : ""}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Showing players registered for {seasonYear}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <LineupTable
          label={homeTeam?.name ?? "Home"}
          teamId={homeTeam?.team_id ?? ""}
          lineup={homeLineup}
        />
        <LineupTable
          label={awayTeam?.name ?? "Away"}
          teamId={awayTeam?.team_id ?? ""}
          lineup={awayLineup}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {homeTeam && (
          <AddPlayerForm
            teamId={homeTeam.team_id}
            players={homePlayers}
            label={homeTeam.name}
          />
        )}
        {awayTeam && (
          <AddPlayerForm
            teamId={awayTeam.team_id}
            players={awayPlayers}
            label={awayTeam.name}
          />
        )}
      </div>
    </div>
  );
}
