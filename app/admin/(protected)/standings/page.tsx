import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { LiveRefresh } from "@/components/LiveRefresh";

type Tally = {
  player_id: string;
  name: string;
  team: string | null;
  count: number;
};

/** Count events of a given type, grouped by player, sorted desc, top N. */
function tally(events: any[], type: string, top = 10): Tally[] {
  const m = new Map<string, Tally>();
  for (const e of events) {
    if (e.event_type !== type) continue;
    const p = e.player;
    if (!p?.player_id) continue;
    const key = p.player_id as string;
    const cur = m.get(key);
    if (cur) cur.count += 1;
    else
      m.set(key, {
        player_id: key,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
        team: p.team?.name ?? null,
        count: 1,
      });
  }
  return Array.from(m.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

function Leaderboard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Tally[];
  empty: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
        <h3 className="font-display text-sm font-semibold text-navy-900 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-500 text-sm">
          {empty}
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.player_id} className={i === 0 ? "bg-gold-50/50" : ""}>
                <td className="px-3 py-2 w-8 text-slate-500 font-medium">
                  {i + 1}
                </td>
                <td className="px-3 py-2 font-medium text-navy-900">{r.name}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {r.team ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-bold text-navy-900 tabular-nums">
                  {r.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: { season?: string };
}) {
  const supabase = createAdminClient();

  // Competitions — used for season selector, standings filter, and mapping
  // competition_id → season for the leaderboard season bucket.
  const { data: comps } = await supabase
    .from("competitions")
    .select("competition_id, name, season")
    .order("name");

  const seasons = Array.from(
    new Set(
      (comps ?? []).map((c: any) => c.season).filter(Boolean) as string[]
    )
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const currentYear = String(new Date().getFullYear());
  const requestedSeason = searchParams.season;
  const selectedSeason =
    requestedSeason && seasons.includes(requestedSeason)
      ? requestedSeason
      : seasons.includes(currentYear)
      ? currentYear
      : seasons[0] ?? "";

  const compMap = new Map<string, { name: string; season: string | null }>();
  (comps ?? []).forEach((c: any) =>
    compMap.set(c.competition_id, { name: c.name, season: c.season ?? null })
  );

  const compIdsInSeason = (comps ?? [])
    .filter((c: any) => c.season === selectedSeason)
    .map((c: any) => c.competition_id as string);

  // --- Standings query ---
  let rows: any[] | null = null;
  let error: any = null;
  if (compIdsInSeason.length > 0) {
    const res = await supabase
      .from("standings")
      .select("*")
      .in("competition_id", compIdsInSeason)
      .order("league_points", { ascending: false });
    rows = res.data;
    error = res.error;
  } else {
    rows = [];
  }

  // --- Scoring events (for leaderboards) ---
  // One fetch across all tries + conversions with player + fixture joins;
  // bucket by season client-side.
  const { data: scoringEvents } = await supabase
    .from("match_events")
    .select(
      `event_type,
       player:player_id(player_id, first_name, last_name, team:team_id(name)),
       fixture:fixture_id(competition_id)`
    )
    .in("event_type", ["try", "conversion"]);

  const compIdSet = new Set(compIdsInSeason);
  const seasonEvents = (scoringEvents ?? []).filter((e: any) => {
    const cid = e.fixture?.competition_id;
    return cid && compIdSet.has(cid);
  });

  const tryLeadersSeason = tally(seasonEvents, "try");
  const convLeadersSeason = tally(seasonEvents, "conversion");
  const tryLeadersAll = tally(scoringEvents ?? [], "try");
  const convLeadersAll = tally(scoringEvents ?? [], "conversion");

  // --- Group standings by competition ---
  const groups = new Map<
    string,
    { name: string; season: string | null; rows: any[] }
  >();
  (rows ?? []).forEach((r: any) => {
    const key = r.competition_id ?? "none";
    if (!groups.has(key)) {
      const c = compMap.get(r.competition_id);
      groups.set(key, {
        name: c?.name ?? r.competition_name ?? "—",
        season: c?.season ?? null,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(r);
  });

  const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["match_results", "fixtures", "match_events"]} />
      <ListHeader title="Standings" />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">
          Season
        </span>
        <select
          name="season"
          defaultValue={selectedSeason}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900"
        >
          {seasons.length === 0 ? (
            <option value="">—</option>
          ) : (
            seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
        >
          Apply
        </button>
        {seasons.length > 1 &&
          selectedSeason !==
            (seasons.includes(currentYear) ? currentYear : seasons[0]) && (
            <Link
              href="/admin/standings"
              className="text-xs text-slate-500 hover:underline"
            >
              reset
            </Link>
          )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      {/* === LEAGUE TABLES === */}
      {sortedGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          {seasons.length === 0
            ? "No competitions yet."
            : `No completed matches in ${selectedSeason} — standings appear once results are recorded.`}
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([key, group]) => (
            <section key={key}>
              <h2 className="font-display text-xl font-bold text-navy-900 mb-3">
                {group.name}
                {group.season && (
                  <span className="text-slate-500 font-normal text-base ml-2">
                    · {group.season}
                  </span>
                )}
              </h2>
              <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
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
                      <th className="px-2 py-2.5 font-medium text-center bg-gold-50">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((r: any, i: number) => (
                      <tr
                        key={`${r.team_id}-${r.competition_id}`}
                        className={i < 4 ? "bg-emerald-50/30" : ""}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-500">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-navy-900">
                          <div className="flex items-center gap-2">
                            {r.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.logo_url} alt="" className="h-6 w-6 rounded object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="h-6 w-6 rounded bg-slate-200 shrink-0" />
                            )}
                            {r.team_name}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-700">
                          {r.played}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-700">
                          {r.won}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-700">
                          {r.drawn}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-700">
                          {r.lost}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600">
                          {r.points_for}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600">
                          {r.points_against}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600">
                          {(r.points_for ?? 0) - (r.points_against ?? 0)}
                        </td>
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

      {/* === SCORING LEADERBOARDS === */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-navy-900 mb-3">
          Scoring Leaders
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Leaderboard
            title={`Top Try Scorers · ${selectedSeason || "—"}`}
            rows={tryLeadersSeason}
            empty={`No tries recorded in ${selectedSeason || "this season"}.`}
          />
          <Leaderboard
            title={`Top Goal Kickers · ${selectedSeason || "—"}`}
            rows={convLeadersSeason}
            empty={`No conversions recorded in ${selectedSeason || "this season"}.`}
          />
          <Leaderboard
            title="Top Try Scorers · All Time"
            rows={tryLeadersAll}
            empty="No tries recorded."
          />
          <Leaderboard
            title="Top Goal Kickers · All Time"
            rows={convLeadersAll}
            empty="No conversions recorded."
          />
        </div>
      </section>
    </div>
  );
}
