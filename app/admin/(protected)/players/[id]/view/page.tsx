import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { createAdminClient } from "@/lib/supabase/server";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Labels + ordering for the stats grid + comparison table. */
const STAT_DEFS: { key: string; label: string }[] = [
  { key: "try", label: "Tries" },
  { key: "try_assist", label: "Try Assists" },
  { key: "conversion", label: "Conversions" },
  { key: "penalty", label: "Penalties" },
  { key: "drop_goal", label: "Drop Goals" },
  { key: "line_break", label: "Line Breaks" },
  { key: "tackle", label: "Tackles" },
  { key: "sin_bin", label: "Sin Bins" },
  { key: "yellow_card", label: "Yellow Cards" },
  { key: "red_card", label: "Red Cards" },
];

type StatMap = Record<string, number>;

function tallyEvents(events: any[]): StatMap {
  const m: StatMap = {};
  for (const def of STAT_DEFS) m[def.key] = 0;
  for (const e of events) {
    if (m[e.event_type] != null) m[e.event_type] += 1;
  }
  return m;
}

function StatCompare({
  label,
  a,
  b,
}: {
  label: string;
  a: number | string;
  b: number | string;
}) {
  const aNum = typeof a === "number" ? a : NaN;
  const bNum = typeof b === "number" ? b : NaN;
  const aWins = Number.isFinite(aNum) && Number.isFinite(bNum) && aNum > bNum;
  const bWins = Number.isFinite(aNum) && Number.isFinite(bNum) && bNum > aNum;
  return (
    <tr className="border-t border-slate-100">
      <td
        className={`px-4 py-2 text-right font-bold tabular-nums w-[40%] ${
          aWins ? "text-emerald-700" : "text-navy-900"
        }`}
      >
        {a}
      </td>
      <td className="px-4 py-2 text-center text-xs uppercase tracking-wider text-slate-500 w-[20%]">
        {label}
      </td>
      <td
        className={`px-4 py-2 text-left font-bold tabular-nums w-[40%] ${
          bWins ? "text-emerald-700" : "text-navy-900"
        }`}
      >
        {b}
      </td>
    </tr>
  );
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { vs?: string };
}) {
  const supabase = createAdminClient();
  const playerId = params.id;
  const vsId = searchParams?.vs || "";

  // Player + team (+ all other players for the H2H dropdown).
  const [{ data: player }, { data: otherPlayers }] = await Promise.all([
    supabase
      .from("players")
      .select(
        "player_id, first_name, last_name, jersey_number, position, playing_status, date_of_birth, height_cm, weight_kg, nationality, is_captain, photo_url, team:team_id(team_id, name, team_type)"
      )
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("players")
      .select("player_id, first_name, last_name, team:team_id(name)")
      .neq("player_id", playerId)
      .order("last_name"),
  ]);
  if (!player) notFound();

  // Supabase types embedded FK joins as T[] — normalise to plain object.
  const team: any = Array.isArray(player.team) ? player.team[0] : player.team;

  // All career events (for stats + matches played).
  const { data: events } = await supabase
    .from("match_events")
    .select(
      "event_id, event_type, minute, fixture:fixture_id(fixture_id, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season), result:match_results(home_score, away_score))"
    )
    .eq("player_id", playerId);

  const stats = tallyEvents(events ?? []);
  const matchesPlayedIds = new Set(
    (events ?? []).map((e: any) => {
      const f = Array.isArray(e.fixture) ? e.fixture[0] : e.fixture;
      return f?.fixture_id;
    }).filter(Boolean)
  );
  const matchesPlayed = matchesPlayedIds.size;

  // Build a flat match-appearances list (one row per distinct fixture).
  const perMatch = new Map<string, any>();
  for (const e of events ?? []) {
    const f: any = Array.isArray(e.fixture) ? e.fixture[0] : e.fixture;
    if (!f?.fixture_id) continue;
    if (!perMatch.has(f.fixture_id)) perMatch.set(f.fixture_id, { fixture: f, stats: {} as StatMap });
    const bucket = perMatch.get(f.fixture_id);
    bucket.stats[e.event_type] = (bucket.stats[e.event_type] ?? 0) + 1;
  }
  const matchRows = Array.from(perMatch.values()).sort((a, b) => {
    const ad = a.fixture.scheduled_date ?? "";
    const bd = b.fixture.scheduled_date ?? "";
    return ad < bd ? 1 : ad > bd ? -1 : 0;
  });

  // Opponent H2H (player vs player).
  let vsPlayer: any = null;
  let vsStats: StatMap | null = null;
  if (vsId) {
    const [{ data: vp }, { data: vpEvents }] = await Promise.all([
      supabase
        .from("players")
        .select("player_id, first_name, last_name, team:team_id(name)")
        .eq("player_id", vsId)
        .maybeSingle(),
      supabase
        .from("match_events")
        .select("event_type")
        .eq("player_id", vsId),
    ]);
    vsPlayer = vp;
    vsStats = tallyEvents(vpEvents ?? []);
  }

  const teamLabel = team?.name ?? "—";

  return (
    <div className="p-4 md:p-8 w-full">
      <Breadcrumb crumbs={[
        { label: "Players", href: "/admin/players" },
        { label: "Edit", href: `/admin/players/${playerId}` },
      ]} />

      {/* Player header */}
      <div className="flex items-start gap-4 mb-6">
        {player.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-500 text-xl font-bold flex items-center justify-center shrink-0">
            {player.first_name?.[0]}{player.last_name?.[0]}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-4xl font-bold text-navy-900 leading-tight">
            {player.first_name} {player.last_name}
            {player.is_captain && (
              <span className="ml-2 text-xs align-middle px-2 py-0.5 rounded bg-gold-50 text-gold-700">
                Captain
              </span>
            )}
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {team && (
              <Link href={`/admin/teams/${team.team_id}/view`} className="hover:underline text-navy-700 font-medium">
                {teamLabel}
              </Link>
            )}
            {team && player.position && <span className="mx-1 text-slate-400">·</span>}
            {player.position && <span>{player.position}</span>}
            {player.jersey_number != null && <span className="ml-1 text-slate-400">#{player.jersey_number}</span>}
          </p>
          <p className="text-slate-400 text-xs mt-0.5 flex flex-wrap gap-x-2">
            {player.date_of_birth && <span>DOB {fmt(player.date_of_birth)}</span>}
            {player.nationality && <span>{player.nationality}</span>}
            {player.playing_status && (
              <span className={`px-1.5 py-0.5 rounded-full ${
                player.playing_status === "active" ? "bg-emerald-50 text-emerald-700" :
                player.playing_status === "injured" ? "bg-amber-50 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>{player.playing_status}</span>
            )}
          </p>
        </div>
      </div>

      {/* Career stats — 3 cols on mobile fills the page cleanly (11 items = 3+3+3+2) */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold text-navy-900 mb-3">
          Career Stats
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">Matches</div>
            <div className="font-display text-2xl text-navy-900 mt-1">{matchesPlayed}</div>
          </div>
          {STAT_DEFS.map((def) => (
            <div key={def.key} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">{def.label}</div>
              <div className="font-display text-2xl text-navy-900 mt-1">{stats[def.key]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* H2H */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold text-navy-900 mb-3">
          Head to Head
        </h2>
        <form className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 mb-3">
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
              Compare vs
            </span>
            <select
              name="vs"
              defaultValue={vsId}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:border-navy-700 focus:outline-none"
            >
              <option value="">— pick a player —</option>
              {(otherPlayers ?? []).map((p: any) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.first_name} {p.last_name}
                  {p.team?.name ? ` · ${p.team.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
          >
            Compare
          </button>
          {vsId && (
            <Link
              href={`/admin/players/${playerId}/view`}
              className="text-xs text-slate-500 hover:underline"
            >
              clear
            </Link>
          )}
          </div>
        </form>

        {vsId && vsPlayer && vsStats && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="text-right">
                <div className="font-display text-lg font-bold text-navy-900">
                  {player.first_name} {player.last_name}
                </div>
                <div className="text-xs text-slate-500">
                  {team?.name ?? "—"}
                </div>
              </div>
              <div className="px-6 text-xs uppercase tracking-wider text-slate-500">
                vs
              </div>
              <div className="text-left">
                <div className="font-display text-lg font-bold text-navy-900">
                  {vsPlayer.first_name} {vsPlayer.last_name}
                </div>
                <div className="text-xs text-slate-500">
                  {vsPlayer.team?.name ?? "—"}
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {STAT_DEFS.map((def) => (
                  <StatCompare
                    key={def.key}
                    label={def.label}
                    a={stats[def.key]}
                    b={vsStats![def.key]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Match log */}
      <section>
        <h2 className="font-display text-xl font-bold text-navy-900 mb-2">
          Match Log ({matchRows.length})
        </h2>
        {matchRows.length === 0 ? (
          <p className="text-slate-500 text-sm bg-white border border-slate-200 rounded-lg px-4 py-6 text-center">
            No recorded match events yet.
          </p>
        ) : (
          <div className="space-y-2">
            {matchRows.map(({ fixture, stats: s }) => {
              const r = Array.isArray(fixture.result) ? fixture.result[0] : fixture.result;
              const score = r ? `${r.home_score} – ${r.away_score}` : "—";
              const contribs = STAT_DEFS.filter((d) => (s as StatMap)[d.key])
                .map((d) => `${(s as StatMap)[d.key]} ${d.label.toLowerCase()}`)
                .join(", ");
              const comp = Array.isArray(fixture.competition) ? fixture.competition[0] : fixture.competition;
              const home = Array.isArray(fixture.home) ? fixture.home[0] : fixture.home;
              const away = Array.isArray(fixture.away) ? fixture.away[0] : fixture.away;
              return (
                <div key={fixture.fixture_id} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-navy-900 text-sm">
                      {home?.name ?? "?"} <span className="text-slate-400">vs</span> {away?.name ?? "?"}
                    </span>
                    <span className="font-display font-bold text-navy-900 tabular-nums shrink-0">{score}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span>{fmt(fixture.scheduled_date)}</span>
                    {comp?.name && <span>· {comp.name}{comp.season ? ` ${comp.season}` : ""}</span>}
                    {contribs && <span className="text-gold-700">· {contribs}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
