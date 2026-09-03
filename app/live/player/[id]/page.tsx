import Link from "next/link";
import { remaining, type Contract } from "@/lib/contracts";
import { Avatar } from "@/components/Avatar";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { RadarChart, RadarLegend, type RadarSeries } from "@/components/RadarChart";
import {
  ATTRIBUTE_AXES,
  attributeAverage,
  attributeValues,
  hasAttributes,
} from "@/lib/attributes";
import { fetchLineupAppearances } from "@/lib/appearances";
import { cleanSecondaryPositions } from "@/lib/positions";
import {
  TEAM_STAT_ROWS,
  eventLabel,
  fmtShortDate,
  normaliseType,
  pointsFrom,
  statValue,
  tally,
  type StatMap,
} from "@/lib/matchStats";

export const dynamic = "force-dynamic";

const PLAYER_COLOR = "#c81e1e";
const VS_COLOR = "#0ea5e9";

// public_players excludes phone/email by construction, so "*" exposes nothing
// private and keeps rendering if the attribute columns aren't added yet.
const PLAYER_SELECT = "*";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("public_players")
    .select("first_name, last_name")
    .eq("player_id", params.id)
    .maybeSingle();
  if (!data) return { title: "Player — RLFG Live" };
  return { title: `${data.first_name} ${data.last_name} — RLFG Live` };
}

export default async function PublicPlayerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { vs?: string };
}) {
  const supabase = createPublicClient();
  const playerId = params.id;
  const vsId = searchParams?.vs || "";

  const [
    { data: player },
    { data: events },
    lineups,
    { data: ratings },
    { data: teams },
    { data: allPlayers },
    { data: contracts },
  ] = await Promise.all([
    supabase
      .from("public_players")
      .select(PLAYER_SELECT)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("match_events")
      .select(
        "event_type, fixture:fixture_id(fixture_id, status, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season), result:match_results(home_score, away_score))"
      )
      .eq("player_id", playerId),
    fetchLineupAppearances(supabase, playerId),
    supabase
      .from("match_player_ratings")
      .select("rating")
      .eq("player_id", playerId),
    supabase.from("teams").select("team_id, name, logo_url"),
    supabase
      .from("public_players")
      .select("player_id, first_name, last_name, team_id")
      .order("last_name")
      .limit(1000),
    // Only accepted contracts are readable without an account, so an offer
    // nobody has answered never shows up here.
    supabase
      .from("contracts")
      .select("contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at, team:team_id(name)")
      .eq("player_id", playerId)
      .eq("status", "accepted"),
  ]);

  if (!player) notFound();

  const teamName = new Map<string, string>(
    ((teams ?? []) as any[]).map((t) => [t.team_id, t.name])
  );
  // What is left to run, where there is a contract at all. A profile that
  // says nothing is a player out of contract, which is worth knowing.
  const contractRow = ((contracts ?? []) as any[])[0] ?? null;
  const contract = remaining(contractRow as Contract);
  const contractClub = contractRow
    ? (Array.isArray(contractRow.team) ? contractRow.team[0] : contractRow.team)?.name
    : null;

  const team = (teams ?? []).find(
    (t: any) => t.team_id === (player as any).team_id
  ) as any;

  // Optional head-to-head comparison on the radar.
  let vsPlayer: any = null;
  if (vsId && vsId !== playerId) {
    const { data } = await supabase
      .from("public_players")
      .select(PLAYER_SELECT)
      .eq("player_id", vsId)
      .maybeSingle();
    vsPlayer = data;
  }

  const allEvents = (events ?? []) as any[];
  const stats: StatMap = tally(allEvents);
  const totalPoints = pointsFrom(allEvents);

  // One row per distinct fixture — squad selections count even with no events.
  const perMatch = new Map<string, { fixture: any; stats: StatMap }>();
  for (const e of allEvents) {
    const f = one<any>(e.fixture);
    if (!f?.fixture_id) continue;
    if (!perMatch.has(f.fixture_id)) {
      perMatch.set(f.fixture_id, { fixture: f, stats: {} });
    }
    const bucket = perMatch.get(f.fixture_id)!;
    const key = normaliseType(e.event_type);
    if (key) bucket.stats[key] = (bucket.stats[key] ?? 0) + 1;
  }
  for (const l of lineups) {
    const f = l.fixture;
    if (!f?.fixture_id || perMatch.has(f.fixture_id)) continue;
    perMatch.set(f.fixture_id, { fixture: f, stats: {} });
  }

  const matchRows = Array.from(perMatch.values()).sort((a, b) => {
    const ad = a.fixture.scheduled_date ?? "";
    const bd = b.fixture.scheduled_date ?? "";
    return ad < bd ? 1 : ad > bd ? -1 : 0;
  });
  const matchesPlayed = perMatch.size;

  const ratingValues = ((ratings ?? []) as any[])
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n));
  const avgRating = ratingValues.length
    ? Math.round((ratingValues.reduce((s, r) => s + r, 0) / ratingValues.length) * 10) / 10
    : null;

  const careerStats = TEAM_STAT_ROWS.map((row) => ({
    label: row.label,
    value: statValue(stats, row.keys),
  })).filter((r) => r.value > 0);

  // The chart only makes sense once this player is rated — a comparison alone
  // would render someone else's shape on their page.
  const playerValues = attributeValues(player);
  const rated = hasAttributes(player);
  const series: RadarSeries[] = [];
  if (rated) {
    series.push({
      label: `${(player as any).first_name} ${(player as any).last_name}`,
      values: playerValues,
      color: PLAYER_COLOR,
    });
    if (vsPlayer && hasAttributes(vsPlayer)) {
      series.push({
        label: `${vsPlayer.first_name} ${vsPlayer.last_name}`,
        values: attributeValues(vsPlayer),
        color: VS_COLOR,
      });
    }
  }
  const overall = attributeAverage(player);

  const p: any = player;
  const cover = cleanSecondaryPositions(p.secondary_positions, p.position);

  return (
    <>
      <Link
        href="/live"
        className="inline-block text-slate-400 hover:text-ghanaYellow-500 text-xs mb-4"
      >
        ← All matches
      </Link>

      {/* Identity */}
      <div className="bg-neutral-900 border border-white/10 rounded-lg p-4 md:p-6 mb-6">
        <div className="flex items-start gap-4">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Avatar
              src={p.photo_url}
              name={`${p.first_name ?? ""} ${p.last_name ?? ""}`}
              size={88}
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 text-slate-400 text-2xl font-bold flex items-center justify-center shrink-0">
              {p.first_name?.[0]}
              {p.last_name?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-4xl leading-tight">
              {p.first_name} {p.last_name}
              {p.playing_status && (
                <span
                  className={`inline-block align-middle ml-2.5 w-2.5 h-2.5 rounded-full ${
                    p.playing_status === "active" ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  title={p.playing_status === "active" ? "Active" : "Not active"}
                />
              )}
              {p.is_captain && (
                <span className="ml-2 align-middle text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-ghanaYellow-500/15 text-ghanaYellow-500">
                  Captain
                </span>
              )}
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              {team?.name ?? "Unattached"}
              {p.position && (
                <span className="text-slate-500"> · {p.position}</span>
              )}
              {p.jersey_number != null && (
                <span className="text-slate-500"> · #{p.jersey_number}</span>
              )}
            </p>
            {cover.length > 0 && (
              <p className="text-slate-500 text-xs mt-1">
                Can also cover {cover.join(", ")}
              </p>
            )}
            {contract && (
              <p className="text-ghanaYellow-500 text-xs mt-1.5">
                {contract.label} left on contract
                {contractClub ? ` with ${contractClub}` : ""}
              </p>
            )}
            <p className="text-slate-500 text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {p.age != null && <span>Age {p.age}</span>}
              {p.height_cm && <span>{p.height_cm} cm</span>}
              {p.weight_kg && <span>{p.weight_kg} kg</span>}
              {p.nationality && <span>{p.nationality}</span>}

            </p>
          </div>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <Stat label="Matches" value={matchesPlayed} />
        <Stat label="Points" value={totalPoints} />
        <Stat label="Tries" value={statValue(stats, ["try"])} />
        <Stat
          label="Avg Rating"
          value={avgRating !== null ? avgRating.toFixed(1) : "—"}
          accent={avgRating !== null}
        />
      </div>

      {/* Attributes radar */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-display text-xl">Attributes</h2>
          {overall !== null && (
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              Overall {overall}
            </span>
          )}
        </div>

        <div className="bg-neutral-900 border border-white/10 rounded-lg p-4">
          {series.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">
              No attribute ratings recorded for this player yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="w-full md:w-[26rem] mx-auto text-white">
                  <RadarChart axes={ATTRIBUTE_AXES} series={series} />
                </div>
                <div className="flex-1 min-w-0">
                  <RadarLegend series={series} />
                  <dl className="mt-4 space-y-1.5">
                    {ATTRIBUTE_AXES.map((label, i) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 text-sm"
                      >
                        <dt className="w-20 shrink-0 text-slate-400 text-xs uppercase tracking-wider">
                          {label}
                        </dt>
                        <dd className="flex-1 flex items-center gap-2">
                          <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${playerValues[i] ?? 0}%`,
                                background: PLAYER_COLOR,
                              }}
                            />
                          </span>
                          <span className="w-8 text-right tabular-nums text-xs">
                            {playerValues[i] ?? "—"}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Compare with another player */}
              <form className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
                <label
                  htmlFor="vs"
                  className="text-[11px] uppercase tracking-wider text-slate-500"
                >
                  Compare with
                </label>
                <select
                  id="vs"
                  name="vs"
                  defaultValue={vsId}
                  className="flex-1 min-w-[12rem] px-3 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
                >
                  <option value="">— pick a player —</option>
                  {((allPlayers ?? []) as any[])
                    .filter((o) => o.player_id !== playerId)
                    .map((o) => (
                      <option key={o.player_id} value={o.player_id}>
                        {o.first_name} {o.last_name}
                        {o.team_id && teamName.get(o.team_id)
                          ? ` · ${teamName.get(o.team_id)}`
                          : ""}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-ghanaGreen-600 hover:bg-ghanaGreen-700 text-white text-sm font-medium transition"
                >
                  Compare
                </button>
                {vsId && (
                  <Link
                    href={`/live/player/${playerId}`}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    clear
                  </Link>
                )}
              </form>
            </>
          )}
        </div>
      </section>

      {/* Career stats */}
      {careerStats.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-3">Career Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {careerStats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </section>
      )}

      {/* Match log */}
      <section className="mb-6">
        <h2 className="font-display text-xl mb-3">
          Match Log ({matchRows.length})
        </h2>
        {matchRows.length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
            No matches played yet.
          </p>
        ) : (
          <div className="space-y-2">
            {matchRows.map(({ fixture, stats: s }) => {
              const r = one<any>(fixture.result);
              const home = one<any>(fixture.home);
              const away = one<any>(fixture.away);
              const comp = one<any>(fixture.competition);
              const contribs = Object.entries(s)
                .map(([k, v]) => `${v}× ${eventLabel(k)}`)
                .join(" · ");
              return (
                <Link
                  key={fixture.fixture_id}
                  href={`/live/${fixture.fixture_id}`}
                  className="block bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 hover:border-white/25 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium truncate">
                      {home?.name ?? "?"}{" "}
                      <span className="text-slate-500">v</span>{" "}
                      {away?.name ?? "?"}
                    </span>
                    <span className="font-display tabular-nums shrink-0">
                      {r ? `${r.home_score} – ${r.away_score}` : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2">
                    <span>{fmtShortDate(fixture.scheduled_date)}</span>
                    {comp?.name && (
                      <span>
                        · {comp.name}
                        {comp.season ? ` ${comp.season}` : ""}
                      </span>
                    )}
                    {contribs && (
                      <span className="text-ghanaYellow-500">· {contribs}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">
        {label}
      </div>
      <div
        className={`font-display text-2xl mt-1 tabular-nums ${
          accent ? "text-ghanaYellow-500" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
