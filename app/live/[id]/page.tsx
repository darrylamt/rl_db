import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TeamBadge, StatusPill } from "../MatchCard";
import {
  TEAM_STAT_ROWS,
  TIMELINE_EVENTS,
  eventLabel,
  fmtDate,
  fmtTime,
  normaliseType,
  pointsFrom,
  statValue,
  tally,
  type StatMap,
} from "@/lib/matchStats";

export const dynamic = "force-dynamic";

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
    .from("fixtures")
    .select("home:home_team_id(name), away:away_team_id(name)")
    .eq("fixture_id", params.id)
    .maybeSingle();
  if (!data) return { title: "Match — RLFG Live" };
  const home = one<any>((data as any).home)?.name ?? "TBC";
  const away = one<any>((data as any).away)?.name ?? "TBC";
  return { title: `${home} v ${away} — RLFG Live` };
}

export default async function MatchCentrePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createPublicClient();
  const fixtureId = params.id;

  const [
    { data: fixture },
    { data: result },
    { data: events },
    { data: lineup },
    { data: ratings },
    { data: officials },
  ] = await Promise.all([
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(team_id, name, logo_url), away:away_team_id(team_id, name, logo_url), venue:venue_id(name, city), competition:competition_id(name, season)"
      )
      .eq("fixture_id", fixtureId)
      .maybeSingle(),
    supabase
      .from("match_results")
      .select(
        "home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals, attendance, video_url"
      )
      .eq("fixture_id", fixtureId)
      .maybeSingle(),
    supabase
      .from("match_events")
      .select(
        "event_id, event_type, minute, half, team_id, player:player_id(player_id, first_name, last_name, jersey_number)"
      )
      .eq("fixture_id", fixtureId)
      .order("half", { ascending: true })
      .order("minute", { ascending: true, nullsFirst: false }),
    supabase
      .from("match_lineups")
      .select(
        "lineup_id, team_id, jersey_number, position, is_starter, player:player_id(player_id, first_name, last_name, photo_url)"
      )
      .eq("fixture_id", fixtureId)
      .order("is_starter", { ascending: false })
      .order("jersey_number", { ascending: true, nullsFirst: false }),
    supabase
      .from("match_player_ratings")
      .select("player_id, rating")
      .eq("fixture_id", fixtureId),
    supabase
      .from("fixture_officials")
      .select("role, official:official_id(first_name, last_name)")
      .eq("fixture_id", fixtureId),
  ]);

  if (!fixture) notFound();

  const f: any = fixture;
  const home = one<any>(f.home);
  const away = one<any>(f.away);
  const comp = one<any>(f.competition);
  const venue = one<any>(f.venue);
  const homeId: string | undefined = home?.team_id;
  const awayId: string | undefined = away?.team_id;

  // Events sometimes land without a team_id; fall back to the squad the player
  // was named in for this fixture.
  const playerTeam = new Map<string, string>();
  for (const l of (lineup ?? []) as any[]) {
    const p = one<any>(l.player);
    if (p?.player_id && l.team_id) playerTeam.set(p.player_id, l.team_id);
  }
  const teamOf = (ev: any): string | undefined => {
    if (ev.team_id) return ev.team_id;
    const p = one<any>(ev.player);
    return p?.player_id ? playerTeam.get(p.player_id) : undefined;
  };

  const allEvents = (events ?? []) as any[];
  const homeEvents = allEvents.filter((e) => teamOf(e) === homeId);
  const awayEvents = allEvents.filter((e) => teamOf(e) === awayId);

  const homeStats: StatMap = tally(homeEvents);
  const awayStats: StatMap = tally(awayEvents);

  // Prefer the recorded score; before one exists, add up the scoring events.
  const homeScore = result?.home_score ?? pointsFrom(homeEvents);
  const awayScore = result?.away_score ?? pointsFrom(awayEvents);
  const hasScore = !!result || allEvents.length > 0;

  const ratingByPlayer = new Map<string, number>();
  for (const r of (ratings ?? []) as any[]) {
    if (r.player_id != null && r.rating != null) {
      ratingByPlayer.set(r.player_id, Number(r.rating));
    }
  }

  // Per-player event tallies for the line-up lists.
  const statsByPlayer = new Map<string, StatMap>();
  for (const e of allEvents) {
    const p = one<any>(e.player);
    if (!p?.player_id) continue;
    const key = normaliseType(e.event_type);
    if (!key) continue;
    const bucket = statsByPlayer.get(p.player_id) ?? {};
    bucket[key] = (bucket[key] ?? 0) + 1;
    statsByPlayer.set(p.player_id, bucket);
  }

  const timeline = allEvents.filter((e) =>
    TIMELINE_EVENTS.has(normaliseType(e.event_type))
  );

  const statRows = TEAM_STAT_ROWS.map((row) => ({
    label: row.label,
    home: statValue(homeStats, row.keys),
    away: statValue(awayStats, row.keys),
  })).filter((r) => r.home > 0 || r.away > 0);

  // The result row carries a scoring breakdown even when no events were entered.
  const scoreBreakdown = result
    ? [
        { label: "Tries", home: result.home_tries, away: result.away_tries },
        {
          label: "Conversions",
          home: result.home_conversions,
          away: result.away_conversions,
        },
        {
          label: "Penalty Goals",
          home: result.home_penalties,
          away: result.away_penalties,
        },
        {
          label: "Drop Goals",
          home: result.home_drop_goals,
          away: result.away_drop_goals,
        },
      ].filter((r) => (r.home ?? 0) > 0 || (r.away ?? 0) > 0)
    : [];

  const lineupFor = (teamId: string | undefined, starter: boolean) =>
    ((lineup ?? []) as any[]).filter(
      (l) => l.team_id === teamId && !!l.is_starter === starter
    );

  return (
    <>
      {/* Only tables in the supabase_realtime publication (see supabase/realtime.sql). */}
      <LiveRefresh tables={["match_events", "match_results", "fixtures", "match_lineups", "match_player_ratings"]} />

      <Link
        href="/live"
        className="inline-block text-slate-400 hover:text-ghanaYellow-500 text-xs mb-4"
      >
        ← All matches
      </Link>

      {/* Scoreboard */}
      <div className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 text-[11px] text-slate-400">
          <span className="truncate">
            {comp?.name ?? "Friendly"}
            {comp?.season ? ` · ${comp.season}` : ""}
            {f.round ? ` · ${f.round}` : ""}
          </span>
          <StatusPill status={f.status} />
        </div>

        <div className="px-4 py-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamBadge team={home} />
          <div className="text-center px-2">
            {hasScore ? (
              <div className="font-display text-4xl md:text-6xl tabular-nums leading-none">
                {homeScore}
                <span className="text-slate-600 mx-2">–</span>
                {awayScore}
              </div>
            ) : (
              <div className="font-display text-2xl md:text-3xl text-slate-400 leading-none">
                {fmtTime(f.scheduled_time) || "vs"}
              </div>
            )}
          </div>
          <TeamBadge team={away} align="right" />
        </div>

        <div className="px-4 py-2.5 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            {fmtDate(f.scheduled_date)}
            {f.scheduled_time ? ` · ${fmtTime(f.scheduled_time)}` : ""}
          </span>
          {venue?.name && (
            <span>
              {venue.name}
              {venue.city ? `, ${venue.city}` : ""}
            </span>
          )}
          {result?.attendance != null && (
            <span>Att. {result.attendance.toLocaleString()}</span>
          )}
        </div>
      </div>

      {result?.video_url && (
        <a
          href={result.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6 bg-ghanaRed-600 hover:bg-ghanaRed-700 text-white text-sm font-semibold text-center px-4 py-2.5 rounded transition"
        >
          Watch match highlights →
        </a>
      )}

      {/* Scoring timeline */}
      <section className="mb-6">
        <h2 className="font-display text-xl mb-3">Match Timeline</h2>
        {timeline.length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-6 text-center text-slate-500 text-sm">
            No scoring events recorded yet.
          </p>
        ) : (
          <ol className="bg-neutral-900 border border-white/10 rounded-lg divide-y divide-white/5">
            {timeline.map((e) => {
              const p = one<any>(e.player);
              const isHome = teamOf(e) === homeId;
              const type = normaliseType(e.event_type);
              const tone =
                type === "red_card"
                  ? "text-ghanaRed-400"
                  : type === "yellow_card" || type === "sin_bin"
                  ? "text-ghanaYellow-500"
                  : "text-emerald-400";
              return (
                <li
                  key={e.event_id}
                  className={`px-4 py-2.5 flex items-center gap-3 text-sm ${
                    isHome ? "" : "flex-row-reverse text-right"
                  }`}
                >
                  <span className="w-10 shrink-0 text-slate-500 tabular-nums text-xs">
                    {e.minute != null ? `${e.minute}'` : "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {p?.player_id ? (
                      <Link
                        href={`/live/player/${p.player_id}`}
                        className="font-medium hover:text-ghanaYellow-500"
                      >
                        {p.first_name} {p.last_name}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown player</span>
                    )}
                    <span className={`ml-2 text-xs ${tone}`}>
                      {eventLabel(e.event_type)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Score breakdown from the recorded result */}
      {scoreBreakdown.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-3">Score Breakdown</h2>
          <div className="bg-neutral-900 border border-white/10 rounded-lg divide-y divide-white/5">
            {scoreBreakdown.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="font-display text-lg tabular-nums">
                  {row.home ?? 0}
                </span>
                <span className="text-center text-xs uppercase tracking-wider text-slate-400">
                  {row.label}
                </span>
                <span className="font-display text-lg tabular-nums text-right">
                  {row.away ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team stats from events */}
      {statRows.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-3">Team Stats</h2>
          <div className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 space-y-3">
            {statRows.map((row) => {
              const total = row.home + row.away;
              const homePct = total ? (row.home / total) * 100 : 50;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold tabular-nums">{row.home}</span>
                    <span className="uppercase tracking-wider text-slate-400 text-[11px]">
                      {row.label}
                    </span>
                    <span className="font-semibold tabular-nums">{row.away}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div
                      className="bg-ghanaGreen-400"
                      style={{ width: `${homePct}%` }}
                    />
                    <div
                      className="bg-ghanaYellow-500"
                      style={{ width: `${100 - homePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TEMPORARY probe — remove once the missing side is explained. */}
      <div
        data-probe={JSON.stringify({
          homeId,
          awayId,
          lineupRows: (lineup ?? []).length,
          perTeam: ((lineup ?? []) as any[]).reduce((a: any, l: any) => {
            a[l.team_id] = (a[l.team_id] ?? 0) + 1;
            return a;
          }, {}),
          homeStarters: lineupFor(homeId, true).length,
          homeBench: lineupFor(homeId, false).length,
          awayStarters: lineupFor(awayId, true).length,
          awayBench: lineupFor(awayId, false).length,
        })}
        hidden
      />

      {/* Line-ups */}
      {(lineup ?? []).length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-3">Line-ups</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { team: home, id: homeId },
              { team: away, id: awayId },
            ].map(({ team, id }) => {
              const starters = lineupFor(id, true);
              const bench = lineupFor(id, false);
              if (starters.length === 0 && bench.length === 0) return null;
              return (
                <div
                  key={id ?? team?.name}
                  className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-white/10 font-medium text-sm">
                    {team?.name ?? "TBC"}
                  </div>
                  <PlayerList
                    rows={starters}
                    statsByPlayer={statsByPlayer}
                    ratingByPlayer={ratingByPlayer}
                  />
                  {bench.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
                        Bench
                      </div>
                      <PlayerList
                        rows={bench}
                        statsByPlayer={statsByPlayer}
                        ratingByPlayer={ratingByPlayer}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Officials */}
      {(officials ?? []).length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl mb-3">Match Officials</h2>
          <div className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
            {((officials ?? []) as any[]).map((o, i) => {
              const off = one<any>(o.official);
              return (
                <span key={i} className="text-slate-300">
                  {off ? `${off.first_name} ${off.last_name}` : "—"}
                  {o.role && (
                    <span className="text-slate-500 text-xs ml-1.5">
                      {o.role}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function PlayerList({
  rows,
  statsByPlayer,
  ratingByPlayer,
}: {
  rows: any[];
  statsByPlayer: Map<string, StatMap>;
  ratingByPlayer: Map<string, number>;
}) {
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((l) => {
        const p = one<any>(l.player);
        const pid = p?.player_id;
        const stats = pid ? statsByPlayer.get(pid) : undefined;
        const rating = pid ? ratingByPlayer.get(pid) : undefined;
        const chips = stats
          ? Object.entries(stats)
              .map(([k, v]) => `${v}× ${eventLabel(k)}`)
              .join(" · ")
          : "";
        const body = (
          <>
            <span className="w-6 shrink-0 text-slate-500 tabular-nums text-xs text-right">
              {l.jersey_number ?? ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm truncate">
                {p ? `${p.first_name} ${p.last_name}` : "—"}
              </span>
              {(l.position || chips) && (
                <span className="block text-[11px] text-slate-500 truncate">
                  {l.position}
                  {l.position && chips ? " · " : ""}
                  {chips}
                </span>
              )}
            </span>
            {rating != null && (
              <span className="shrink-0 font-display text-sm tabular-nums px-1.5 py-0.5 rounded bg-white/10 text-ghanaYellow-500">
                {rating.toFixed(1)}
              </span>
            )}
          </>
        );
        return (
          <li key={l.lineup_id}>
            {pid ? (
              <Link
                href={`/live/player/${pid}`}
                className="px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition"
              >
                {body}
              </Link>
            ) : (
              <span className="px-4 py-2 flex items-center gap-3">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
