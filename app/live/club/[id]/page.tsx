import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { MatchCard } from "@/app/live/MatchCard";
import { FIXTURE_SELECT } from "@/lib/matchStats";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
import { GRADES, YOUTH_UNSPECIFIED, effectiveGrade } from "@/lib/grades";
import {
  formatOf,
  formatLabel,
  divisionLabel,
  formatsIn,
  divisionsIn,
  seasonsIn,
  inSeasonRange,
} from "@/lib/competitionFormat";
import { Pagination } from "@/components/admin/Pagination";

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
    .from("teams")
    .select("name")
    .eq("team_id", params.id)
    .maybeSingle();
  if (!data) return { title: "Club — RLFG Live" };
  return { title: `${data.name} — RLFG Live` };
}

const TABS = [
  { key: "squad", label: "Squad" },
  { key: "fixtures", label: "Fixtures" },
  { key: "results", label: "Results" },
  { key: "record", label: "Record" },
  { key: "h2h", label: "Head to head" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function PublicClubPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    tab?: string;
    page?: string;
    vs?: string;
    division?: string;
    format?: string;
    from?: string;
    to?: string;
  };
}) {
  const supabase = createPublicClient();
  const teamId = params.id;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: team }, { data: squad }, { data: fixtures }] =
    await Promise.all([
      supabase
        .from("teams")
        .select(
          "team_id, name, region, city, logo_url, founded_year, home_venue:home_venue_id(name)"
        )
        .eq("team_id", teamId)
        .eq("team_type", "club")
        .neq("is_public", false)
        .maybeSingle(),
      // Two columns arrive by migration, and they are dropped one at a time
      // rather than together: gender first, then category. Dropping both at
      // once — which is what one call with both listed as optional does —
      // would take the grade grouping away over a missing gender, and losing
      // the whole squad over it is exactly the bug this replaces.
      readWithOptionalColumns(
        "player_id, first_name, last_name, jersey_number, position, is_captain, photo_url, category, gender",
        ["gender"],
        (withoutGender) =>
          readWithOptionalColumns(withoutGender, ["category"], (columns) =>
            supabase
              .from("public_players")
              .select(columns)
              .eq("team_id", teamId)
              .eq("playing_status", "active")
              .order("jersey_number", { ascending: true, nullsFirst: false })
          )
      ),
      supabase
        .from("fixtures")
        .select(`${FIXTURE_SELECT}, result:match_results(home_score, away_score)`)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("scheduled_date", { ascending: false })
        .limit(200),
    ]);

  if (!team) notFound();

  const homeVenue = one<any>((team as any).home_venue);

  const hasScore = (f: any) => {
    const r = one<any>(f.result);
    return !!r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0);
  };

  const all = (fixtures ?? []) as any[];
  const upcoming = all
    .filter((f) => f.status === "scheduled" && f.scheduled_date >= today)
    .sort(
      (a, b) =>
        (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "") ||
        (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "")
    );
  const recent = all.filter((f) => hasScore(f));

  const tab: TabKey =
    (TABS.find((t) => t.key === searchParams?.tab)?.key as TabKey) ?? "squad";

  /**
   * Who this club has played, and how it has gone against each of them.
   *
   * Counted from the same completed fixtures the Record tab uses, so the two
   * cannot disagree. Only matches with a score against them count — a fixture
   * nobody recorded is not a draw.
   */
  const played = all.filter((f) => {
    const r = one<any>(f.result);
    return !!r && r.home_score != null && r.away_score != null;
  });

  const oppFilter = {
    division: searchParams?.division ?? "",
    format: searchParams?.format ?? "",
    from: searchParams?.from ?? "",
    to: searchParams?.to ?? "",
  };

  type Side = { played: number; won: number; drawn: number; lost: number; for: number; against: number };
  const blank = (): Side => ({ played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0 });

  // Every opponent, with how many completed matches there have been. Built
  // before the filters so the list of who you can pick does not shrink to
  // nothing the moment a filter is set.
  const opponents = new Map<string, { id: string; name: string; logo: string | null; n: number }>();
  for (const f of played) {
    const home = one<any>(f.home);
    const away = one<any>(f.away);
    const isHome = home?.team_id === teamId;
    const opp = isHome ? away : home;
    if (!opp?.team_id || opp.team_id === teamId) continue;
    const cur = opponents.get(opp.team_id);
    if (cur) cur.n += 1;
    else opponents.set(opp.team_id, { id: opp.team_id, name: opp.name, logo: opp.logo_url ?? null, n: 1 });
  }
  const opponentList = Array.from(opponents.values()).sort(
    (a, b) => b.n - a.n || a.name.localeCompare(b.name)
  );

  const vsId = searchParams?.vs && opponents.has(searchParams.vs) ? searchParams.vs : "";
  const vsTeam = vsId ? opponents.get(vsId)! : null;

  // The meetings themselves, once an opponent is chosen and the filters are
  // applied. Kept as rows so the tally and the list are the same matches.
  const meetings = vsId
    ? played.filter((f) => {
        const home = one<any>(f.home);
        const away = one<any>(f.away);
        const isHome = home?.team_id === teamId;
        const opp = isHome ? away : home;
        if (opp?.team_id !== vsId) return false;
        const comp = one<any>(f.competition);
        if (oppFilter.format && formatOf(comp?.name) !== oppFilter.format) return false;
        if (oppFilter.division && (comp?.division ?? "men") !== oppFilter.division) return false;
        if (!inSeasonRange(comp?.season, oppFilter.from, oppFilter.to)) return false;
        return true;
      })
    : [];

  const us = blank();
  const them = blank();
  for (const f of meetings) {
    const r = one<any>(f.result);
    const home = one<any>(f.home);
    const isHome = home?.team_id === teamId;
    const ours = isHome ? r.home_score : r.away_score;
    const theirs = isHome ? r.away_score : r.home_score;
    us.played += 1; them.played += 1;
    us.for += ours; us.against += theirs;
    them.for += theirs; them.against += ours;
    if (ours > theirs) { us.won += 1; them.lost += 1; }
    else if (ours < theirs) { us.lost += 1; them.won += 1; }
    else { us.drawn += 1; them.drawn += 1; }
  }

  // Only offer a filter that leads somewhere: the competitions these two have
  // actually met in, not every competition on record.
  const metIn = (vsId ? played.filter((f) => {
    const home = one<any>(f.home);
    const away = one<any>(f.away);
    const isHome = home?.team_id === teamId;
    return (isHome ? away : home)?.team_id === vsId;
  }) : []).map((f) => {
    const c = one<any>(f.competition);
    return { name: c?.name ?? null, division: c?.division ?? null, season: c?.season ?? null };
  });
  const h2hFormats = formatsIn(metIn);
  const h2hDivisions = divisionsIn(metIn);
  const h2hSeasons = seasonsIn(metIn);

  /** A link that keeps the tab and the other filters where they are. */
  const h2hHref = (next: Record<string, string>) => {
    const sp = new URLSearchParams();
    sp.set("tab", "h2h");
    const merged = { vs: vsId, ...oppFilter, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/live/club/${teamId}?${sp.toString()}`;
  };

  const PAGE_SIZE = 10;
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const resultsPage = recent.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /**
   * What this club actually plays, and how it has gone in each.
   *
   * A club fields several sides, so one combined record says very little —
   * the 13s men and the 9s women are different teams wearing the same badge.
   * Grouped by format and division, every season together.
   */
  type Line = {
    key: string;
    label: string;
    division: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
  };
  const byLine = new Map<string, Line>();
  for (const f of all) {
    const comp = one<any>(f.competition);
    if (!comp?.name || !hasScore(f)) continue;
    const division = comp.division ?? "men";
    const label = formatLabel(formatOf(comp.name)) ?? comp.name;
    const key = `${label}__${division}`;
    if (!byLine.has(key)) {
      byLine.set(key, { key, label, division, played: 0, won: 0, drawn: 0, lost: 0 });
    }
    const line = byLine.get(key)!;
    const r = one<any>(f.result);
    const isHome = one<any>(f.home)?.team_id === teamId;
    const ours = isHome ? r.home_score : r.away_score;
    const theirs = isHome ? r.away_score : r.home_score;
    if (ours == null || theirs == null) continue;
    line.played += 1;
    if (ours > theirs) line.won += 1;
    else if (ours < theirs) line.lost += 1;
    else line.drawn += 1;
  }
  const lines = Array.from(byLine.values()).sort(
    (a, b) => b.played - a.played || a.label.localeCompare(b.label)
  );

  // Men, women, youth boys and youth girls are different sides from the same
  // club, so the squad reads as several lists rather than one of eighty names.
  //
  // Plain "Youth" is kept as a group of its own for players whose gender is
  // not known — which is every youth player until the view carries the
  // column. Without it they would all be filed under "Other", which is a
  // worse answer than the one the page could already give.
  const GROUPS = [...GRADES, { value: YOUTH_UNSPECIFIED, label: "Youth" }];
  const squadRows = (squad ?? []) as any[];
  const graded = GROUPS.map((g) => ({
    label: g.label,
    players: squadRows.filter((p) => effectiveGrade(p.category, p.gender) === g.value),
  })).filter((g) => g.players.length > 0);
  const ungraded = squadRows.filter(
    (p) => !GROUPS.some((g) => effectiveGrade(p.category, p.gender) === g.value)
  );
  const squadGroups = [
    ...graded,
    ...(ungraded.length > 0
      ? [{ label: graded.length > 0 ? "Other" : "Squad", players: ungraded }]
      : []),
  ];

  return (
    <>
      <Link
        href="/live"
        className="inline-block text-slate-400 hover:text-ghanaYellow-500 text-xs mb-4"
      >
        ← Live scores
      </Link>

      {/* Identity */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar src={team.logo_url} name={team.name} size={64} contain />
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-4xl leading-tight truncate">
            {team.name}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {[team.city, team.region].filter(Boolean).join(", ") || "Ghana"}
            {homeVenue?.name && <span> · {homeVenue.name}</span>}
            {team.founded_year && <span> · Founded {team.founded_year}</span>}
          </p>
        </div>
      </div>

      {/* Sections rather than one long scroll — a club page is four
          different questions and nobody is asking all of them at once. */}
      <div className="flex bg-neutral-900 border border-white/10 rounded-full p-1 mb-6 max-w-md">
        {TABS.map((t) => {
          const count =
            t.key === "squad"
              ? squadRows.length
              : t.key === "fixtures"
              ? upcoming.length
              : t.key === "results"
              ? recent.length
              : lines.length;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={
                t.key === "squad"
                  ? `/live/club/${teamId}`
                  : `/live/club/${teamId}?tab=${t.key}`
              }
              className={`flex-1 text-center text-xs sm:text-sm font-medium rounded-full py-1.5 transition ${
                active ? "bg-white text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`ml-1 text-[11px] tabular-nums ${
                    active ? "text-black/50" : "text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "record" && (
        <section className="mb-8">
          <p className="text-[11px] text-slate-500 mb-3">
            The club fields more than one team. Every season counted together.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {lines.map((l) => (
              <div
                key={l.key}
                className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {l.label}
                    <span className="text-slate-500">
                      {" · "}
                      {divisionLabel(l.division) ?? l.division}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {l.played} played
                  </p>
                </div>
                <p className="font-display text-sm tabular-nums shrink-0">
                  <span className="text-emerald-400">{l.won}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-slate-400">{l.drawn}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{l.lost}</span>
                </p>
              </div>
            ))}
          </div>
          {lines.length === 0 && (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
              Nothing played yet.
            </p>
          )}
        </section>
      )}

      {tab === "h2h" && (
        <section className="mb-8">
          <p className="text-[11px] text-slate-500 mb-3">
            Every completed meeting. A fixture with no score recorded against
            it is not counted as a draw.
          </p>

          {opponentList.length === 0 ? (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
              No completed matches yet, so there is nobody to compare against.
            </p>
          ) : (
            <>
              <div className="flex gap-1.5 flex-wrap mb-5">
                {opponentList.map((o) => (
                  <Link
                    key={o.id}
                    href={
                      o.id === vsId
                        ? `/live/club/${teamId}?tab=h2h`
                        : h2hHref({ vs: o.id, division: "", format: "", from: "", to: "" })
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
                      o.id === vsId
                        ? "bg-white text-black border-white font-semibold"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Avatar src={o.logo} name={o.name} size={16} contain />
                    <span>{o.name}</span>
                    <span className={o.id === vsId ? "text-black/50" : "text-slate-500"}>
                      {o.n}
                    </span>
                  </Link>
                ))}
              </div>

              {!vsTeam ? (
                <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
                  Pick a club above to see the head to head.
                </p>
              ) : (
                <>
                  {(h2hDivisions.length > 1 ||
                    h2hFormats.length > 1 ||
                    h2hSeasons.length > 1) && (
                    <div className="flex gap-1.5 flex-wrap mb-4">
                      {h2hDivisions.length > 1 &&
                        h2hDivisions.map((d) => (
                          <Link
                            key={d.key}
                            href={h2hHref({
                              division: oppFilter.division === d.key ? "" : d.key,
                            })}
                            className={`px-3 py-1.5 rounded-full text-xs border transition ${
                              oppFilter.division === d.key
                                ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {d.label}
                          </Link>
                        ))}
                      {h2hFormats.length > 1 &&
                        h2hFormats.map((f) => (
                          <Link
                            key={f.key}
                            href={h2hHref({
                              format: oppFilter.format === f.key ? "" : f.key,
                            })}
                            className={`px-3 py-1.5 rounded-full text-xs border transition ${
                              oppFilter.format === f.key
                                ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {f.label}
                          </Link>
                        ))}
                      {h2hSeasons.length > 1 &&
                        h2hSeasons.map((y) => {
                          const only = oppFilter.from === y && oppFilter.to === y;
                          return (
                            <Link
                              key={y}
                              href={h2hHref({ from: only ? "" : y, to: only ? "" : y })}
                              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                                only
                                  ? "bg-white text-black border-white font-semibold"
                                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                              }`}
                            >
                              {y}
                            </Link>
                          );
                        })}
                    </div>
                  )}

                  {meetings.length === 0 ? (
                    <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
                      No meetings match those filters.
                    </p>
                  ) : (
                    <>
                      {/* The record, both ways round. */}
                      <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar
                              src={(team as any).logo_url}
                              name={(team as any).name}
                              size={28}
                              contain
                            />
                            <span className="text-sm font-medium truncate">
                              {(team as any).name}
                            </span>
                          </span>
                          <span className="font-display text-2xl tabular-nums shrink-0">
                            <span className="text-emerald-400">{us.won}</span>
                            <span className="text-slate-600"> &ndash; </span>
                            <span className="text-slate-400">{us.drawn}</span>
                            <span className="text-slate-600"> &ndash; </span>
                            <span className="text-red-400">{them.won}</span>
                          </span>
                          <span className="flex items-center gap-2 min-w-0 justify-end">
                            <span className="text-sm font-medium truncate">
                              {vsTeam.name}
                            </span>
                            <Avatar src={vsTeam.logo} name={vsTeam.name} size={28} contain />
                          </span>
                        </div>

                        <dl className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                              Met
                            </dt>
                            <dd className="font-display text-xl tabular-nums mt-0.5">
                              {us.played}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                              Points
                            </dt>
                            <dd className="font-display text-xl tabular-nums mt-0.5">
                              {us.for}
                            </dd>
                            <dd className="text-[10px] text-slate-500">
                              {them.for} against
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                              Win rate
                            </dt>
                            <dd className="font-display text-xl tabular-nums mt-0.5">
                              {us.played > 0
                                ? `${Math.round((us.won / us.played) * 100)}%`
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="space-y-2">
                        {meetings.map((f) => {
                          const r = one<any>(f.result);
                          const home = one<any>(f.home);
                          const away = one<any>(f.away);
                          const comp = one<any>(f.competition);
                          const isHome = home?.team_id === teamId;
                          const ours = isHome ? r.home_score : r.away_score;
                          const theirs = isHome ? r.away_score : r.home_score;
                          const outcome =
                            ours > theirs ? "W" : ours < theirs ? "L" : "D";
                          return (
                            <Link
                              key={f.fixture_id}
                              href={`/live/${f.fixture_id}`}
                              className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 transition"
                            >
                              <span
                                className={`w-6 h-6 rounded grid place-items-center text-[11px] font-bold shrink-0 ${
                                  outcome === "W"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : outcome === "L"
                                      ? "bg-red-500/15 text-red-400"
                                      : "bg-white/10 text-slate-400"
                                }`}
                              >
                                {outcome}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm truncate">
                                  {home?.name} <span className="text-slate-500">v</span>{" "}
                                  {away?.name}
                                </span>
                                <span className="block text-[11px] text-slate-500 truncate">
                                  {[f.scheduled_date, comp?.name, comp?.season]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                              <span className="font-display tabular-nums shrink-0">
                                {r.home_score}&ndash;{r.away_score}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {tab === "fixtures" && (
        <section className="mb-8">
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((f) => (
                <MatchCard key={f.fixture_id} fixture={f} />
              ))}
            </div>
          ) : (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
              Nothing scheduled yet.
            </p>
          )}
        </section>
      )}

      {tab === "results" && (
        <section className="mb-8">
          {recent.length > 0 ? (
            <>
              <div className="space-y-2">
                {resultsPage.map((f) => (
                  <MatchCard key={f.fixture_id} fixture={f} />
                ))}
              </div>
              {recent.length > PAGE_SIZE && (
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={recent.length}
                />
              )}
            </>
          ) : (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
              No results recorded yet.
            </p>
          )}
        </section>
      )}

      {tab === "squad" && (
      <section>
        {squadRows.length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
            No active squad listed yet.
          </p>
        ) : (
          squadGroups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 pb-1 border-b border-white/10">
                {group.label}
                <span className="text-slate-600"> · {group.players.length}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.players.map((p: any) => (
                  <Link
                    key={p.player_id}
                    href={`/live/player/${p.player_id}`}
                    className="flex items-center gap-2.5 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2.5 hover:border-white/25 transition min-w-0"
                  >
                    <Avatar
                      src={p.photo_url}
                      name={`${p.first_name ?? ""} ${p.last_name ?? ""}`}
                      size={36}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {p.first_name} {p.last_name}
                        {p.is_captain && (
                          <span className="ml-1 text-[10px] align-middle text-ghanaYellow-500">C</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {[p.jersey_number != null ? `#${p.jersey_number}` : null, p.position]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
      )}
    </>
  );
}
