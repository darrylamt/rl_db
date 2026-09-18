import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { divisionLabel } from "@/lib/competitionFormat";

export const dynamic = "force-dynamic";

/**
 * Matches that were played but never written down.
 *
 * The match-day screen only ever showed today and what was still to come,
 * which is right for a recorder standing at a ground and wrong for the other
 * job: going back through seasons nobody entered at the time. The entry
 * screens themselves always worked on any fixture — /enter/events pulls in a
 * linked match whatever its date — so all that was missing was a way to reach
 * one.
 *
 * Season, then competition, then match. Each match says what is already on
 * record, because the point of the list is finding the gaps rather than
 * admiring the matches that are done.
 */

type Row = {
  fixture_id: string;
  scheduled_date: string | null;
  competition_id: string | null;
  home: any;
  away: any;
  status: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams?: { season?: string; competition?: string };
}) {
  const supabase = createAdminClient();

  const [{ data: comps }, { data: fixtures }] = await Promise.all([
    supabase
      .from("competitions")
      .select("competition_id, name, season, division")
      .order("name"),
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, competition_id, status, home:home_team_id(name), away:away_team_id(name)"
      )
      .order("scheduled_date", { ascending: false })
      .limit(1000),
  ]);

  const competitions = (comps ?? []) as any[];
  const all = (fixtures ?? []) as Row[];

  // What is already recorded against each fixture. Counted with head requests
  // per table rather than pulled down in full — the page needs "is there
  // anything" and "how many", not the rows themselves.
  const ids = all.map((f) => f.fixture_id);
  const results = new Set<string>();
  const eventCount = new Map<string, number>();
  const lineupCount = new Map<string, number>();

  if (ids.length > 0) {
    // PostgREST caps a response at a thousand rows, and these three can each
    // outrun that, so they page.
    const pageThrough = async (table: string, columns: string) => {
      const out: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .range(from, from + 999);
        if (error || !data) break;
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    };

    const [res, evs, lus] = await Promise.all([
      pageThrough("match_results", "fixture_id, home_score, away_score"),
      pageThrough("match_events", "fixture_id"),
      pageThrough("match_lineups", "fixture_id"),
    ]);

    for (const r of res) {
      if (r.home_score != null && r.away_score != null) results.add(r.fixture_id);
    }
    for (const e of evs) {
      eventCount.set(e.fixture_id, (eventCount.get(e.fixture_id) ?? 0) + 1);
    }
    for (const l of lus) {
      lineupCount.set(l.fixture_id, (lineupCount.get(l.fixture_id) ?? 0) + 1);
    }
  }

  const seasons = Array.from(
    new Set(competitions.map((c) => c.season).filter(Boolean) as string[])
  ).sort((a, b) => b.localeCompare(a));

  const season = searchParams?.season ?? seasons[0] ?? "";
  const inSeason = competitions.filter((c) => c.season === season);
  const compIds = new Set(inSeason.map((c) => c.competition_id));

  const chosen = searchParams?.competition ?? "";
  const matches = all
    .filter((f) => f.competition_id && compIds.has(f.competition_id))
    .filter((f) => !chosen || f.competition_id === chosen);

  // How much of each competition is still blank, so the list itself says
  // where the work is.
  const missingIn = (competitionId: string) =>
    all.filter(
      (f) => f.competition_id === competitionId && !results.has(f.fixture_id)
    ).length;

  const href = (next: { season?: string; competition?: string }) => {
    const p = new URLSearchParams();
    const s = next.season ?? season;
    const c = "competition" in next ? next.competition : chosen;
    if (s) p.set("season", s);
    if (c) p.set("competition", c);
    const q = p.toString();
    return q ? `/enter/archive?${q}` : "/enter/archive";
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-2xl">Fill in an old match</h1>
        <p className="text-slate-400 text-sm mt-1">
          Matches that were played but never recorded. Pick a season, then a
          competition, then the match.
        </p>
      </header>

      {seasons.length === 0 ? (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
          No competitions on record yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {seasons.map((s) => (
              <Link
                key={s}
                href={href({ season: s, competition: "" })}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  s === season
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-900 border border-white/10 text-slate-300 hover:text-white"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5">
            <Link
              href={href({ competition: "" })}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                !chosen
                  ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Every competition
            </Link>
            {inSeason.map((c) => {
              const gaps = missingIn(c.competition_id);
              return (
                <Link
                  key={c.competition_id}
                  href={href({ competition: c.competition_id })}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    chosen === c.competition_id
                      ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {c.name}
                  {c.division && (
                    <span className="opacity-60"> · {divisionLabel(c.division) ?? c.division}</span>
                  )}
                  {gaps > 0 && (
                    <span
                      className={
                        chosen === c.competition_id
                          ? "ml-1.5 text-black/60"
                          : "ml-1.5 text-ghanaYellow-500"
                      }
                    >
                      {gaps} to do
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {matches.length === 0 ? (
            <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
              No fixtures entered for {season}.
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((f) => {
                const hasResult = results.has(f.fixture_id);
                const events = eventCount.get(f.fixture_id) ?? 0;
                const named = lineupCount.get(f.fixture_id) ?? 0;
                const comp = competitions.find(
                  (c) => c.competition_id === f.competition_id
                );
                return (
                  <li
                    key={f.fixture_id}
                    className="bg-neutral-900 border border-white/10 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight truncate">
                          {one<any>(f.home)?.name ?? "?"}{" "}
                          <span className="text-slate-500">v</span>{" "}
                          {one<any>(f.away)?.name ?? "?"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {[f.scheduled_date, comp?.name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                          hasResult
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-ghanaYellow-500/15 text-ghanaYellow-500"
                        }`}
                      >
                        {hasResult ? "Result in" : "No result"}
                      </span>
                    </div>

                    {/* What is already down against this match. */}
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      {named > 0 ? `${named} named` : "no team sheet"} ·{" "}
                      {events > 0 ? `${events} events` : "no events"}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Link
                        href={`/enter/result?fixture=${f.fixture_id}`}
                        className="text-center text-sm font-medium border border-white/15 rounded px-3 py-2 hover:bg-white/5"
                      >
                        {hasResult ? "Edit result" : "Add result"}
                      </Link>
                      <Link
                        href={`/enter/events?fixture=${f.fixture_id}`}
                        className="text-center text-sm font-medium bg-ghanaYellow-500 text-black rounded px-3 py-2 hover:bg-ghanaYellow-400"
                      >
                        {events > 0 ? "Edit stats" : "Add stats"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-slate-500 mt-4">
            Showing {matches.length} match
            {matches.length === 1 ? "" : "es"}. A match with no team sheet can
            still have its stats entered &mdash; the picker falls back to the
            whole squad for that grade &mdash; but naming the side first makes
            the list shorter and the appearance record right.
          </p>
        </>
      )}
    </div>
  );
}
