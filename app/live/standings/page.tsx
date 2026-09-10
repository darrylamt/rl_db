import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { createPublicClient } from "@/lib/supabase/server";
import { getSeasonState } from "@/lib/seasons";
import { divisionLabel } from "@/lib/competitionFormat";

export const dynamic = "force-dynamic";

type Row = {
  team_id: string;
  team_name: string;
  logo_url: string | null;
  competition_id: string;
  competition_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  goal_difference: number | null;
  league_points: number;
};

/**
 * The table, for whoever is looking.
 *
 * Read straight from the standings view rather than counted here, so the
 * public table and the federation's own are the same arithmetic — a league
 * table that disagrees with itself depending on who is looking at it is
 * worse than no league table.
 *
 * Grouped by competition rather than pooled. Men's, women's and youth are
 * separate competitions, and a single ladder mixing them would be a ranking
 * of nothing.
 */
export default async function StandingsPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const supabase = createPublicClient();

  const [{ data: comps }, { data: table }, seasonState] = await Promise.all([
    supabase
      .from("competitions")
      .select("competition_id, name, season, division")
      .order("name"),
    supabase.from("standings").select("*"),
    getSeasonState(),
  ]);

  const competitions = (comps ?? []) as any[];
  const rows = (table ?? []) as Row[];

  // Newest first, so the season selector opens on what people are asking about.
  const seasons = Array.from(
    new Set(competitions.map((c) => c.season).filter(Boolean) as string[])
  ).sort((a, b) => b.localeCompare(a));

  // The federation says which season is running; the selector can override it,
  // and a season with nothing in it falls back to the newest that has.
  const wanted = searchParams?.season;
  const selected =
    wanted && seasons.includes(wanted)
      ? wanted
      : seasons.includes(seasonState.season)
        ? seasonState.season
        : (seasons[0] ?? "");

  const inSeason = competitions.filter((c) => c.season === selected);

  const groups = inSeason
    .map((c) => ({
      id: c.competition_id as string,
      name: c.name as string,
      division: c.division as string | null,
      rows: rows
        .filter((r) => r.competition_id === c.competition_id)
        .sort(
          (a, b) =>
            b.league_points - a.league_points ||
            (b.goal_difference ?? b.points_for - b.points_against) -
              (a.goal_difference ?? a.points_for - a.points_against) ||
            b.points_for - a.points_for ||
            a.team_name.localeCompare(b.team_name)
        ),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold">Table</h1>
        <p className="text-slate-400 text-sm mt-1">
          Three points for a win, one for a draw. Level on points is split by
          points difference, then by points scored.
        </p>
      </header>

      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/live/standings?season=${s}`}
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                s === selected
                  ? "bg-white text-black font-medium"
                  : "bg-neutral-900 border border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              {s}
              {s === seasonState.season && !seasonState.fallback && (
                <span
                  className={`ml-1.5 text-[10px] uppercase tracking-wider ${
                    s === selected ? "text-black/50" : "text-ghanaYellow-500"
                  }`}
                >
                  now
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-10 text-center">
          <p className="font-display text-lg">Nothing to show for {selected}</p>
          <p className="text-slate-400 text-sm mt-1.5">
            A table appears once results have been recorded for a competition
            in this season.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section
              key={g.id}
              className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-lg">{g.name}</h2>
                {g.division && (
                  <span className="text-[10px] uppercase tracking-wider text-ghanaYellow-500">
                    {divisionLabel(g.division)}
                  </span>
                )}
                <span className="text-xs text-slate-500 ml-auto">
                  {g.rows.length} teams
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[34rem]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-right">
                      <th className="px-3 py-2 w-8 text-left font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium">Team</th>
                      <th className="px-2 py-2 font-medium">P</th>
                      <th className="px-2 py-2 font-medium">W</th>
                      <th className="px-2 py-2 font-medium">D</th>
                      <th className="px-2 py-2 font-medium">L</th>
                      <th className="px-2 py-2 font-medium hidden sm:table-cell">
                        PF
                      </th>
                      <th className="px-2 py-2 font-medium hidden sm:table-cell">
                        PA
                      </th>
                      <th className="px-2 py-2 font-medium">PD</th>
                      <th className="px-3 py-2 font-medium text-white">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {g.rows.map((r, i) => {
                      const pd =
                        r.goal_difference ?? r.points_for - r.points_against;
                      return (
                        <tr
                          key={r.team_id}
                          className={`text-right tabular-nums ${
                            i === 0 ? "bg-ghanaYellow-500/5" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-left text-slate-500">
                            {i + 1}
                          </td>
                          <td className="px-2 py-2.5 text-left">
                            <Link
                              href={`/live/club/${r.team_id}`}
                              className="flex items-center gap-2 min-w-0 hover:text-ghanaYellow-500"
                            >
                              <Avatar
                                src={r.logo_url}
                                name={r.team_name}
                                size={22}
                              />
                              <span className="truncate">{r.team_name}</span>
                            </Link>
                          </td>
                          <td className="px-2 py-2.5 text-slate-300">
                            {r.played}
                          </td>
                          <td className="px-2 py-2.5 text-slate-300">{r.won}</td>
                          <td className="px-2 py-2.5 text-slate-300">
                            {r.drawn}
                          </td>
                          <td className="px-2 py-2.5 text-slate-300">
                            {r.lost}
                          </td>
                          <td className="px-2 py-2.5 text-slate-400 hidden sm:table-cell">
                            {r.points_for}
                          </td>
                          <td className="px-2 py-2.5 text-slate-400 hidden sm:table-cell">
                            {r.points_against}
                          </td>
                          <td
                            className={`px-2 py-2.5 ${
                              pd > 0
                                ? "text-ghanaGreen-500"
                                : pd < 0
                                  ? "text-ghanaRed-500"
                                  : "text-slate-400"
                            }`}
                          >
                            {pd > 0 ? `+${pd}` : pd}
                          </td>
                          <td className="px-3 py-2.5 font-display font-bold">
                            {r.league_points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-5">
        Built from results as they are recorded. A match without a score
        against it is not counted.
      </p>
    </div>
  );
}
