import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/admin/Breadcrumb";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type TallyRow = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
};

function emptyTally(): TallyRow {
  return { played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 };
}

function applyMatch(
  t: TallyRow,
  ourScore: number,
  theirScore: number
): TallyRow {
  const next = { ...t };
  next.played += 1;
  next.pointsFor += ourScore;
  next.pointsAgainst += theirScore;
  if (ourScore > theirScore) next.won += 1;
  else if (ourScore < theirScore) next.lost += 1;
  else next.drawn += 1;
  return next;
}

function leaguePoints(t: TallyRow) {
  return t.won * 2 + t.drawn;
}

function StatRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number | string;
  b: number | string;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 text-right font-bold text-navy-900 tabular-nums w-[40%]">
        {a}
      </td>
      <td className="px-4 py-2 text-center text-xs uppercase tracking-wider text-slate-500 w-[20%]">
        {label}
      </td>
      <td className="px-4 py-2 text-left font-bold text-navy-900 tabular-nums w-[40%]">
        {b}
      </td>
    </tr>
  );
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { vs?: string };
}) {
  const supabase = createAdminClient();
  const teamId = params.id;
  const vsId = searchParams?.vs || "";

  // Team + home venue + full team list (for the compare dropdown).
  const [{ data: team }, { data: allTeams }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "team_id, name, team_type, region, city, manager_name, coach_name, founded_year, logo_url, home_venue:home_venue_id(name)"
      )
      .eq("team_id", teamId)
      .maybeSingle(),
    supabase
      .from("teams")
      .select("team_id, name")
      .neq("team_id", teamId)
      .order("name"),
  ]);
  if (!team) notFound();

  // Supabase types embedded FK joins as arrays — normalise.
  const homeVenue: any = Array.isArray(team.home_venue) ? team.home_venue[0] : team.home_venue;

  // Roster — grouped by category.
  const { data: allRoster } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, jersey_number, position, playing_status, is_captain, gender, category")
    .eq("team_id", teamId)
    .order("jersey_number", { ascending: true, nullsFirst: false });

  const roster        = (allRoster ?? []).filter((p: any) => !p.category || p.category === "senior_men");
  const womenRoster   = (allRoster ?? []).filter((p: any) => p.category === "senior_women");
  const youthRoster   = (allRoster ?? []).filter((p: any) => p.category === "youth");

  // All fixtures involving this team, with results + competition division.
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      `fixture_id, scheduled_date, status, home_team_id, away_team_id,
       home:home_team_id(name),
       away:away_team_id(name),
       competition:competition_id(name, season, division),
       result:match_results(home_score, away_score)`
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("scheduled_date", { ascending: false });

  // Aggregate overall + build match rows for display.
  const completed = (fixtures ?? []).filter((f: any) => {
    const r = Array.isArray(f.result) ? f.result[0] : f.result;
    return r && (r.home_score != null || r.away_score != null);
  });

  let overall = emptyTally();
  const matchRows: {
    fixture_id: string;
    date: string | null;
    competition: string | null;
    division: string;
    opponent_id: string | null;
    opponent: string;
    homeAway: "H" | "A";
    score: string;
    result: "W" | "D" | "L";
  }[] = [];

  for (const f of completed) {
    const r = Array.isArray(f.result) ? f.result[0] : f.result;
    if (!r) continue;
    const isHome = f.home_team_id === teamId;
    const ourScore = isHome ? r.home_score : r.away_score;
    const theirScore = isHome ? r.away_score : r.home_score;
    if (ourScore == null || theirScore == null) continue;

    const comp: any = Array.isArray(f.competition) ? f.competition[0] : f.competition;
    const home: any = Array.isArray(f.home) ? f.home[0] : f.home;
    const away: any = Array.isArray(f.away) ? f.away[0] : f.away;
    const division: string = comp?.division ?? "men";

    // Only include in overall tally for men's fixtures
    if (division === "men") overall = applyMatch(overall, ourScore, theirScore);
    matchRows.push({
      fixture_id: f.fixture_id,
      date: f.scheduled_date,
      competition: comp?.name
        ? `${comp.name}${comp.season ? ` · ${comp.season}` : ""}`
        : null,
      division,
      opponent_id: isHome ? f.away_team_id : f.home_team_id,
      opponent: (isHome ? away?.name : home?.name) ?? "?",
      homeAway: isHome ? "H" : "A",
      score: `${ourScore} – ${theirScore}`,
      result: ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : "D",
    });
  }

  // H2H stats — if ?vs= set, compute both sides' aggregate from their shared
  // completed fixtures.
  let vsTeam: { team_id: string; name: string } | null = null;
  let ourVs = emptyTally();
  let theirVs = emptyTally();

  if (vsId) {
    const { data: vt } = await supabase
      .from("teams")
      .select("team_id, name")
      .eq("team_id", vsId)
      .maybeSingle();
    vsTeam = vt as any;

    for (const f of completed) {
      const isHome = f.home_team_id === teamId;
      const oppId = isHome ? f.away_team_id : f.home_team_id;
      if (oppId !== vsId) continue;
      const r = Array.isArray(f.result) ? f.result[0] : f.result;
      if (!r) continue;
      const ourScore = isHome ? r.home_score : r.away_score;
      const theirScore = isHome ? r.away_score : r.home_score;
      if (ourScore == null || theirScore == null) continue;
      ourVs = applyMatch(ourVs, ourScore, theirScore);
      theirVs = applyMatch(theirVs, theirScore, ourScore);
    }
  }

  const winRate =
    overall.played === 0 ? "—" : `${Math.round((overall.won / overall.played) * 100)}%`;

  return (
    <div className="p-4 md:p-8">
      <Breadcrumb crumbs={[
        { label: "Teams", href: "/admin/teams" },
        { label: "Edit", href: `/admin/teams/${teamId}` },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            {team.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logo_url}
                alt=""
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
              />
            )}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">
              {team.name}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              team.team_type === "national" ? "bg-emerald-100 text-emerald-800" :
              team.team_type === "president_xv" ? "bg-amber-100 text-amber-800" :
              "bg-slate-100 text-slate-700"
            }`}>
              {team.team_type === "national" ? "National" :
               team.team_type === "president_xv" ? "President XIII" : "Club"}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {[team.city, team.region].filter(Boolean).join(", ") || "—"}
            {homeVenue?.name && (
              <>
                <span className="mx-2">·</span>Home: {homeVenue.name}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: "Played", value: overall.played },
          { label: "Won", value: overall.won },
          { label: "Drawn", value: overall.drawn },
          { label: "Lost", value: overall.lost },
          { label: "Pts For", value: overall.pointsFor },
          { label: "Pts Against", value: overall.pointsAgainst },
          { label: "Win Rate", value: winRate },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-lg p-3 text-center"
          >
            <div className="text-xs uppercase tracking-wider text-slate-500">
              {s.label}
            </div>
            <div className="font-display text-2xl text-navy-900 mt-1">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* H2H */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold text-navy-900 mb-2">
          Head to Head
        </h2>
        <form className="flex flex-wrap items-end gap-2 mb-3 bg-white border border-slate-200 rounded-lg p-3">
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
              Compare vs
            </span>
            <select
              name="vs"
              defaultValue={vsId}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[12rem]"
            >
              <option value="">— pick an opponent —</option>
              {(allTeams ?? []).map((t: any) => (
                <option key={t.team_id} value={t.team_id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
          >
            Compare
          </button>
          {vsId && (
            <Link
              href={`/admin/teams/${teamId}/view`}
              className="text-xs text-slate-500 hover:underline"
            >
              clear
            </Link>
          )}
        </form>

        {vsId && vsTeam && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="text-right font-display text-lg font-bold text-navy-900">
                {team.name}
              </div>
              <div className="px-6 text-xs uppercase tracking-wider text-slate-500">
                vs
              </div>
              <div className="text-left font-display text-lg font-bold text-navy-900">
                {vsTeam.name}
              </div>
            </div>
            {ourVs.played === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                No completed matches between these teams yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  <StatRow label="Played" a={ourVs.played} b={theirVs.played} />
                  <StatRow label="Won" a={ourVs.won} b={theirVs.won} />
                  <StatRow label="Drawn" a={ourVs.drawn} b={theirVs.drawn} />
                  <StatRow label="Lost" a={ourVs.lost} b={theirVs.lost} />
                  <StatRow label="Pts For" a={ourVs.pointsFor} b={theirVs.pointsFor} />
                  <StatRow label="Pts Against" a={ourVs.pointsAgainst} b={theirVs.pointsAgainst} />
                  <StatRow label="League Pts" a={leaguePoints(ourVs)} b={leaguePoints(theirVs)} />
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* Roster sections by category */}
      {[
        { label: "Senior Men", players: roster, badge: "bg-navy-100 text-navy-800" },
        { label: "Senior Women", players: womenRoster, badge: "bg-pink-100 text-pink-800" },
        { label: "Youth", players: youthRoster, badge: "bg-amber-100 text-amber-800" },
      ].filter(({ players }) => players.length > 0).map(({ label, players, badge }) => (
        <section key={label} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg font-bold text-navy-900">{label}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{players.length}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium w-12">#</th>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="hidden sm:table-cell px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.map((p: any) => (
                  <tr key={p.player_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{p.jersey_number ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-navy-900">
                      <Link href={`/admin/players/${p.player_id}/view`} className="hover:underline">
                        {p.first_name} {p.last_name}
                      </Link>
                      {p.is_captain && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-gold-50 text-gold-700">C</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-slate-600">{p.position ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        p.playing_status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>{p.playing_status ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Matches — split by division */}
      {(["men", "women", "youth"] as const)
        .map((div) => ({ div, rows: matchRows.filter((m) => m.division === div) }))
        .filter(({ rows }) => rows.length > 0)
        .map(({ div, rows }) => {
          const divLabel = div === "men" ? "Senior Men" : div === "women" ? "Senior Women" : "Youth";
          const divBadge = div === "men" ? "bg-navy-100 text-navy-800" : div === "women" ? "bg-pink-100 text-pink-800" : "bg-amber-100 text-amber-800";
          return (
            <section key={div} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-display text-lg font-bold text-navy-900">Matches — {divLabel}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${divBadge}`}>{rows.length}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="hidden sm:table-cell px-3 py-2 font-medium">Competition</th>
                      <th className="px-3 py-2 font-medium">H/A</th>
                      <th className="px-3 py-2 font-medium">Opponent</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium">W/D/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((m) => (
                      <tr key={m.fixture_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">{fmt(m.date)}</td>
                        <td className="hidden sm:table-cell px-3 py-2 text-slate-600 text-xs">{m.competition ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{m.homeAway}</td>
                        <td className="px-3 py-2 text-navy-900">
                          {m.opponent_id ? (
                            <Link href={`/admin/teams/${m.opponent_id}/view`} className="hover:underline">{m.opponent}</Link>
                          ) : m.opponent}
                        </td>
                        <td className="px-3 py-2 font-display font-bold text-navy-900 tabular-nums">{m.score}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            m.result === "W" ? "bg-emerald-100 text-emerald-800" :
                            m.result === "L" ? "bg-red-100 text-red-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>{m.result}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      }
    </div>
  );
}
