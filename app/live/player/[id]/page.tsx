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
  formatOf,
  formatLabel,
  divisionLabel,
  formatsIn,
  divisionsIn,
  seasonsIn,
  inSeasonRange,
} from "@/lib/competitionFormat";
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
  searchParams?: {
    vs?: string;
    format?: string;
    division?: string;
    from?: string;
    to?: string;
  };
}) {
  const supabase = createPublicClient();
  const playerId = params.id;
  const vsId = searchParams?.vs || "";
  const formatId = searchParams?.format || "";
  const divisionId = searchParams?.division || "";
  const fromSeason = searchParams?.from || "";
  const toSeason = searchParams?.to || "";

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
        "event_type, fixture:fixture_id(fixture_id, status, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season, division), result:match_results(home_score, away_score))"
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

  /** The competition an event's fixture was played in, however deep the join. */
  const eventComp = (e: any) => {
    const f = one<any>(e.fixture);
    const c = one<any>(f?.competition);
    return {
      name: c?.name ?? null,
      division: c?.division ?? null,
      season: c?.season ?? null,
    };
  };

  const inScope = (e: any) => {
    const c = eventComp(e);
    if (formatId && formatOf(c.name) !== formatId) return false;
    if (divisionId && (c.division ?? "men") !== divisionId) return false;
    if (!inSeasonRange(c.season, fromSeason, toSeason)) return false;
    return true;
  };

  // Optional comparison with another player.
  let vsPlayer: any = null;
  let vsStats: StatMap | null = null;
  if (vsId && vsId !== playerId) {
    const [{ data }, { data: vpEvents }] = await Promise.all([
      supabase
        .from("public_players")
        .select(PLAYER_SELECT)
        .eq("player_id", vsId)
        .maybeSingle(),
      supabase
        .from("match_events")
        .select(
          "event_type, fixture:fixture_id(competition:competition_id(name, season, division))"
        )
        .eq("player_id", vsId),
    ]);
    vsPlayer = data;
    vsStats = tally(((vpEvents ?? []) as any[]).filter(inScope));
  }

  const everyEvent = (events ?? []) as any[];
  const scopeFilters = formatsIn(everyEvent.map(eventComp));
  const scopeDivisions = divisionsIn(everyEvent.map(eventComp));
  const scopeSeasons = seasonsIn(everyEvent.map(eventComp));
  const scopeLabel = [
    divisionLabel(divisionId),
    formatLabel(formatId),
    fromSeason || toSeason
      ? `${fromSeason || "start"}–${toSeason || "now"}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const allEvents = everyEvent.filter(inScope);
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
    // A squad selection carries the same competition as an event does, so
    // the filters have to reach it too — otherwise narrowing to the 9s still
    // counts every 13s match this player was named in.
    if (!inScope({ fixture: f })) continue;
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
      <div className="relative rounded-3xl overflow-hidden mb-4 bg-gradient-to-b from-violet-900 via-purple-900 to-violet-950 border border-white/10">
        <div className="relative h-72 md:h-96">
          {/* The surname behind the head, the way a shirt number sits behind
              a player — decoration that still says whose page this is. */}
          <span
            aria-hidden
            className="absolute top-4 inset-x-0 text-center font-display text-[4.5rem] md:text-[7rem] leading-none text-white/10 tracking-tight select-none truncate px-2"
          >
            {(p.last_name || p.first_name || "").toUpperCase()}
          </span>

          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photo_url}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-[7rem] md:text-[9rem] leading-none text-white/15">
                {p.first_name?.[0]}
                {p.last_name?.[0]}
              </span>
            </div>
          )}

          {/* Violet over the photo, deepening to the foot of the card so the
              name reads over anybody's picture. */}
          <div className="absolute inset-0 bg-gradient-to-t from-violet-950 via-violet-950/70 to-transparent" />
          <div className="absolute inset-0 bg-violet-800/20 mix-blend-overlay" />

          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-3xl md:text-5xl leading-[0.95] text-white drop-shadow">
                {p.first_name}
                <br />
                {p.last_name}
                {p.playing_status && (
                  <span
                    className={`inline-block align-middle ml-2.5 w-2.5 h-2.5 rounded-full ${
                      p.playing_status === "active" ? "bg-emerald-400" : "bg-red-500"
                    }`}
                    title={p.playing_status === "active" ? "Active" : "Not active"}
                  />
                )}
              </h1>
              <p className="text-violet-100/90 text-sm mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {team?.name ?? "Unattached"}
                {p.position && (
                  <span className="text-violet-200/60">· {p.position}</span>
                )}
                {p.jersey_number != null && (
                  <span className="text-violet-200/60">· #{p.jersey_number}</span>
                )}
                {p.is_captain && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-ghanaYellow-500/20 text-ghanaYellow-500">
                    Captain
                  </span>
                )}
              </p>
            </div>

            {team?.logo_url && (
              <Avatar
                src={team.logo_url}
                name={team.name}
                size={56}
                rounded="none"
                className="rounded-xl shrink-0 drop-shadow"
                contain
              />
            )}
          </div>
        </div>
      </div>

      {/* Below the fold of the hero — bio and contract, kept plain rather
          than fighting the photo for attention. */}
      {(contract || cover.length > 0 || p.age != null || p.height_cm || p.weight_kg || p.nationality) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-6 text-xs">
          {contract && (
            <span className="text-ghanaYellow-500">
              {contract.label} left on contract
              {contractClub ? ` with ${contractClub}` : ""}
            </span>
          )}
          {cover.length > 0 && (
            <span className="text-slate-500">Can also cover {cover.join(", ")}</span>
          )}
          {p.age != null && <span className="text-slate-500">Age {p.age}</span>}
          {p.height_cm && <span className="text-slate-500">{p.height_cm} cm</span>}
          {p.weight_kg && <span className="text-slate-500">{p.weight_kg} kg</span>}
          {p.nationality && <span className="text-slate-500">{p.nationality}</span>}
        </div>
      )}

      {/* What is being counted, and who against */}
      <form className="bg-neutral-900 border border-white/10 rounded-xl p-3 mb-6 flex flex-wrap items-end gap-2">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Compare with
          </span>
          <select
            name="vs"
            defaultValue={vsId}
            className="w-full px-3 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
          >
            <option value="">— nobody —</option>
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
        </label>

        {scopeDivisions.length > 0 && (
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              Division
            </span>
            <select
              name="division"
              defaultValue={divisionId}
              className="px-3 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
            >
              <option value="">All</option>
              {scopeDivisions.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </label>
        )}

        {scopeFilters.length > 0 && (
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              Competition
            </span>
            <select
              name="format"
              defaultValue={formatId}
              className="px-3 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
            >
              <option value="">All</option>
              {scopeFilters.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </label>
        )}

        {scopeSeasons.length > 1 && (
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              Seasons
            </span>
            <span className="flex items-center gap-1">
              <select
                name="from"
                defaultValue={fromSeason}
                className="px-2 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
              >
                <option value="">Any</option>
                {scopeSeasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-slate-500 text-xs">to</span>
              <select
                name="to"
                defaultValue={toSeason}
                className="px-2 py-1.5 rounded border border-white/15 bg-neutral-950 text-sm text-white focus:outline-none focus:border-white/40"
              >
                <option value="">Any</option>
                {scopeSeasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </span>
          </label>
        )}

        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-ghanaGreen-600 hover:bg-ghanaGreen-700 text-white text-sm font-medium transition"
        >
          Apply
        </button>
        {(vsId || formatId || divisionId || fromSeason || toSeason) && (
          <Link
            href={`/live/player/${playerId}`}
            className="text-xs text-slate-500 hover:text-white pb-2"
          >
            clear
          </Link>
        )}
      </form>

      {/* Headline numbers */}
      {scopeLabel && (
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          {scopeLabel}
        </p>
      )}
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

              <p className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-500">
                Attributes are scouting ratings for the player overall, so the
                filters above do not change them — the stats and match log
                they do change.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Stats side by side, on whatever is currently filtered */}
      {vsPlayer && vsStats && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-1">Stats compared</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            {scopeLabel || "All competitions, all seasons"}
          </p>
          <div className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-white/5 border-b border-white/10 px-4 py-3 text-sm">
              <div className="text-right font-medium truncate">
                {p.first_name} {p.last_name}
              </div>
              <div className="px-4 text-[11px] uppercase tracking-wider text-slate-500">
                vs
              </div>
              <div className="text-left font-medium truncate">
                {vsPlayer.first_name} {vsPlayer.last_name}
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {TEAM_STAT_ROWS.map((row) => {
                  const a = statValue(stats, row.keys);
                  const b = statValue(vsStats!, row.keys);
                  if (a === 0 && b === 0) return null;
                  return (
                    <tr key={row.label} className="border-t border-white/5">
                      <td
                        className={`px-4 py-2 text-right tabular-nums w-[40%] ${
                          a > b ? "text-ghanaYellow-500 font-semibold" : ""
                        }`}
                      >
                        {a}
                      </td>
                      <td className="px-4 py-2 text-center text-[11px] uppercase tracking-wider text-slate-500 w-[20%]">
                        {row.label}
                      </td>
                      <td
                        className={`px-4 py-2 text-left tabular-nums w-[40%] ${
                          b > a ? "text-ghanaYellow-500 font-semibold" : ""
                        }`}
                      >
                        {b}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
          <>
            {/* Five is enough to see form; the rest is a career and belongs
                behind a tap rather than down a page nobody scrolls. */}
            <div className="space-y-2">
              {matchRows.slice(0, 5).map((m) => (
                <MatchRow key={m.fixture.fixture_id} row={m} />
              ))}
            </div>

            {matchRows.length > 5 && (
              <details className="group mt-2 [&_summary::-webkit-details-marker]:hidden">
                <summary className="list-none cursor-pointer select-none text-center text-xs text-slate-400 hover:text-white bg-neutral-900 border border-white/10 rounded-lg py-2.5">
                  <span className="group-open:hidden">
                    Show {matchRows.length - 5} more
                  </span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                <div className="space-y-2 mt-2">
                  {matchRows.slice(5).map((m) => (
                    <MatchRow key={m.fixture.fixture_id} row={m} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>
    </>
  );
}

function MatchRow({
  row,
}: {
  row: { fixture: any; stats: StatMap };
}) {
  const { fixture, stats: s } = row;
  const r = one<any>(fixture.result);
  const home = one<any>(fixture.home);
  const away = one<any>(fixture.away);
  const comp = one<any>(fixture.competition);
  const contribs = Object.entries(s)
    .map(([k, v]) => `${v}× ${eventLabel(k)}`)
    .join(" · ");

  return (
    <Link
      href={`/live/${fixture.fixture_id}`}
      className="block bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 hover:border-white/25 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium truncate">
          {home?.name ?? "?"} <span className="text-slate-500">v</span>{" "}
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
        {contribs && <span className="text-ghanaYellow-500">· {contribs}</span>}
      </div>
    </Link>
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
    <div className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-center">
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
