import Link from "next/link";
import { notFound } from "next/navigation";
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

  // All career events (for stats + matches played).
  const { data: events } = await supabase
    .from("match_events")
    .select(
      "event_id, event_type, minute, fixture:fixture_id(fixture_id, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season), result:match_results(home_score, away_score))"
    )
    .eq("player_id", playerId);

  const stats = tallyEvents(events ?? []);
  const matchesPlayedIds = new Set(
    (events ?? []).map((e: any) => e.fixture?.fixture_id).filter(Boolean)
  );
  const matchesPlayed = matchesPlayedIds.size;

  // Build a flat match-appearances list (one row per distinct fixture).
  const perMatch = new Map<string, any>();
  for (const e of events ?? []) {
    const f = e.fixture;
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

  const teamLabel = player.team?.name ?? "—";

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href="/admin/players" className="text-slate-500 hover:underline">
          ← Players
        </Link>
        <span className="text-slate-300">/</span>
        <Link
          href={`/admin/players/${playerId}`}
          className="text-slate-500 hover:underline"
        >
          Edit
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        {player.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photo_url}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-slate-200"
          />
        )}
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">
            {player.first_name} {player.last_name}
            {player.is_captain && (
              <span className="ml-2 text-xs align-middle px-2 py-0.5 rounded bg-gold-50 text-gold-700">
                Captain
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {player.jersey_number != null && <span className="font-mono">#{player.jersey_number}</span>}
            {player.jersey_number != null && (player.position || player.team) && <span className="mx-2">·</span>}
            {player.position && <span>{player.position}</span>}
            {player.position && player.team && <span className="mx-2">·</span>}
            {player.team && (
              <Link
                href={`/admin/teams/${player.team.team_id}/view`}
                className="hover:underline text-navy-700"
              >
                {teamLabel}
              </Link>
            )}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {[
              player.nationality ?? null,
              player.date_of_birth ? `DOB ${fmt(player.date_of_birth)}` : null,
              player.height_cm ? `${player.height_cm} cm` : null,
              player.weight_kg ? `${player.weight_kg} kg` : null,
              player.playing_status ?? null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* Career stats grid */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold text-navy-900 mb-2">
          Career Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500">Matches</div>
            <div className="font-display text-2xl text-navy-900 mt-1">
              {matchesPlayed}
            </div>
          </div>
          {STAT_DEFS.map((def) => (
            <div
              key={def.key}
              className="bg-white border border-slate-200 rounded-lg p-3 text-center"
            >
              <div className="text-xs uppercase tracking-wider text-slate-500">
                {def.label}
              </div>
              <div className="font-display text-2xl text-navy-900 mt-1">
                {stats[def.key]}
              </div>
            </div>
          ))}
        </div>
      </section>

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
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[14rem]"
            >
              <option value="">— pick a player —</option>
              {(otherPlayers ?? []).map((p: any) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.first_name} {p.last_name}
                  {p.team?.name ? ` · ${p.team.name}` : ""}
                </option>
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
              href={`/admin/players/${playerId}/view`}
              className="text-xs text-slate-500 hover:underline"
            >
              clear
            </Link>
          )}
        </form>

        {vsId && vsPlayer && vsStats && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="text-right">
                <div className="font-display text-lg font-bold text-navy-900">
                  {player.first_name} {player.last_name}
                </div>
                <div className="text-xs text-slate-500">
                  {player.team?.name ?? "—"}
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
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Competition</th>
                <th className="px-3 py-2 font-medium">Match</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Contributions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matchRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                    No recorded match events yet.
                  </td>
                </tr>
              ) : (
                matchRows.map(({ fixture, stats: s }) => {
                  const r = Array.isArray(fixture.result) ? fixture.result[0] : fixture.result;
                  const score = r
                    ? `${r.home_score} – ${r.away_score}`
                    : "—";
                  const contribs = STAT_DEFS.filter((d) => (s as StatMap)[d.key])
                    .map((d) => `${(s as StatMap)[d.key]} ${d.label.toLowerCase()}`)
                    .join(", ");
                  return (
                    <tr key={fixture.fixture_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {fmt(fixture.scheduled_date)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {fixture.competition?.name ?? "—"}
                        {fixture.competition?.season && (
                          <span className="text-slate-400">
                            {" "}
                            · {fixture.competition.season}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-navy-900">
                        {fixture.home?.name ?? "?"}{" "}
                        <span className="text-slate-400">vs</span>{" "}
                        {fixture.away?.name ?? "?"}
                      </td>
                      <td className="px-3 py-2 font-display font-bold text-navy-900 tabular-nums">
                        {score}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{contribs || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
