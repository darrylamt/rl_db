import { createAdminClient } from "@/lib/supabase/server";

/**
 * What a referee or a coach has actually done.
 *
 * Both answer the same shape of question — which matches was this person on,
 * and how did they go — from different tables, so the counting lives in one
 * place and the two public pages differ only in how they read.
 *
 * A coach's record covers matches with a team sheet, and two thirds of
 * matches on record have none. The figure says so rather than quietly
 * presenting a third of a career as the whole of it.
 */

export type MatchLine = {
  fixtureId: string;
  date: string | null;
  competition: string | null;
  season: string | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  /** For a coach: which side they were on. Null for an official. */
  side: "home" | "away" | null;
  /** For a coach: won / lost / drew. Null when there is no result. */
  outcome: "won" | "lost" | "drew" | null;
  /** For an official: referee / touch judge. */
  role: string | null;
};

export type Record_ = {
  matches: number;
  won: number;
  lost: number;
  drawn: number;
  /** Matches with a score against them. The rest are fixtures with no result. */
  decided: number;
  lines: MatchLine[];
};

const ROLE_WORDS: Record<string, string> = {
  referee: "Referee",
  touch_judge_1: "Touch judge",
  touch_judge_2: "Touch judge",
};

export function roleLabel(role: string | null | undefined): string {
  return ROLE_WORDS[role ?? ""] ?? role ?? "";
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** The fixtures behind a set of ids, with names and scores attached. */
async function linesFor(
  fixtureIds: string[],
  roleOf: (fixtureId: string) => string | null,
  sideOf: (fixtureId: string) => "home" | "away" | null
): Promise<MatchLine[]> {
  if (fixtureIds.length === 0) return [];
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name, season), result:match_results(home_score, away_score)"
    )
    .in("fixture_id", fixtureIds)
    .order("scheduled_date", { ascending: false });

  return ((data ?? []) as any[]).map((f) => {
    const r = one<any>(f.result);
    const comp = one<any>(f.competition);
    const side = sideOf(f.fixture_id);
    const home = r?.home_score ?? null;
    const away = r?.away_score ?? null;

    let outcome: MatchLine["outcome"] = null;
    if (side && home != null && away != null) {
      const ours = side === "home" ? home : away;
      const theirs = side === "home" ? away : home;
      outcome = ours > theirs ? "won" : ours < theirs ? "lost" : "drew";
    }

    return {
      fixtureId: f.fixture_id,
      date: f.scheduled_date ?? null,
      competition: comp?.name ?? null,
      season: comp?.season ?? null,
      homeName: one<any>(f.home)?.name ?? "—",
      awayName: one<any>(f.away)?.name ?? "—",
      homeScore: home,
      awayScore: away,
      side,
      outcome,
      role: roleOf(f.fixture_id),
    };
  });
}

function tally(lines: MatchLine[]): Record_ {
  let won = 0;
  let lost = 0;
  let drawn = 0;
  let decided = 0;
  for (const l of lines) {
    if (l.homeScore != null && l.awayScore != null) decided += 1;
    if (l.outcome === "won") won += 1;
    else if (l.outcome === "lost") lost += 1;
    else if (l.outcome === "drew") drawn += 1;
  }
  return { matches: lines.length, won, lost, drawn, decided, lines };
}

/** Every match this official was appointed to. */
export async function getOfficialRecord(officialId: string): Promise<Record_> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fixture_officials")
    .select("fixture_id, role")
    .eq("official_id", officialId);

  const rows = (data ?? []) as any[];
  const roleBy = new Map(rows.map((r) => [r.fixture_id, r.role]));
  const lines = await linesFor(
    rows.map((r) => r.fixture_id),
    (id) => roleBy.get(id) ?? null,
    () => null
  );
  return tally(lines);
}

/** Every match this coach was named on, and how the side went. */
export async function getCoachRecord(coachId: string): Promise<Record_> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("team_sheets")
    .select("fixture_id, team_id, head_coach_id, assistant_coach_id")
    .or(`head_coach_id.eq.${coachId},assistant_coach_id.eq.${coachId}`);

  const rows = (data ?? []) as any[];
  if (rows.length === 0) return tally([]);

  // Which side of each match they were on, so a result can be read as a win
  // or a loss rather than only as a score.
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("fixture_id, home_team_id")
    .in(
      "fixture_id",
      rows.map((r) => r.fixture_id)
    );
  const homeTeam = new Map(
    ((fixtures ?? []) as any[]).map((f) => [f.fixture_id, f.home_team_id])
  );

  const sideBy = new Map<string, "home" | "away">();
  const roleBy = new Map<string, string>();
  for (const r of rows) {
    sideBy.set(
      r.fixture_id,
      homeTeam.get(r.fixture_id) === r.team_id ? "home" : "away"
    );
    roleBy.set(
      r.fixture_id,
      r.head_coach_id === coachId ? "Head coach" : "Assistant"
    );
  }

  const lines = await linesFor(
    rows.map((r) => r.fixture_id),
    (id) => roleBy.get(id) ?? null,
    (id) => sideBy.get(id) ?? null
  );
  return tally(lines);
}
