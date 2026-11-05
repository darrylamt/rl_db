import type { createPublicClient, createAdminClient } from "@/lib/supabase/server";

/**
 * League tables, from the league phase only.
 *
 * The standings view counted every completed match in a competition, so a
 * season's playoff and final went into the table too: in 2026 that lifted
 * Dragons, who won the playoff, as if they had topped the league phase. A
 * match is a playoff when its round says so (Playoff, Quarter-final, Semi-final,
 * Final, QF/SF/GF, Qualifier, Eliminator...); everything else is the league.
 *
 * The rows have the same shape the standings view returns, so the pages
 * that read the view can read this instead unchanged.
 */

/** A knockout match: its round names a playoff, semi, final and the like. */
export function isPlayoffRound(round: string | null | undefined): boolean {
  return /play\s*-?\s*off|quarter|semi|final|qualif|elimin|knock\s*-?\s*out|^\s*(qf|sf|gf)\d*\s*$/i.test(String(round ?? ""));
}

export type TableRow = {
  team_id: string;
  team_name: string;
  logo_url: string | null;
  competition_id: string;
  competition_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  goal_difference: number;
  league_points: number;
};

export type PlayoffMatch = {
  fixture_id: string;
  competition_id: string;
  round: string | null;
  scheduled_date: string | null;
  home: { team_id: string; name: string; logo_url: string | null } | null;
  away: { team_id: string; name: string; logo_url: string | null } | null;
  home_score: number | null;
  away_score: number | null;
};

type Client = ReturnType<typeof createPublicClient> | ReturnType<typeof createAdminClient>;

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/**
 * The league table for some competitions (or all), sorted: three for a win,
 * one for a draw, then points difference, then points scored. Plus the
 * playoff matches, kept apart for showing under the table.
 */
export async function getLeagueTables(
  supabase: Client,
  competitionIds?: string[]
): Promise<{ rows: TableRow[]; playoffs: PlayoffMatch[] }> {
  if (competitionIds && competitionIds.length === 0) return { rows: [], playoffs: [] };

  let q = supabase
    .from("fixtures")
    .select(
      "fixture_id, competition_id, round, status, scheduled_date, home:home_team_id(team_id, name, logo_url), away:away_team_id(team_id, name, logo_url), competition:competition_id(name), result:match_results(home_score, away_score)"
    )
    .order("scheduled_date", { ascending: true });
  if (competitionIds) q = q.in("competition_id", competitionIds);
  const { data } = await q;

  const table = new Map<string, TableRow>();
  const playoffs: PlayoffMatch[] = [];

  for (const f of (data ?? []) as any[]) {
    const r = one<any>(f.result);
    const home = one<any>(f.home);
    const away = one<any>(f.away);

    if (isPlayoffRound(f.round)) {
      playoffs.push({
        fixture_id: f.fixture_id,
        competition_id: f.competition_id,
        round: f.round,
        scheduled_date: f.scheduled_date,
        home, away,
        home_score: r?.home_score ?? null,
        away_score: r?.away_score ?? null,
      });
      continue;
    }

    // As the view did: completed matches with a result.
    if (f.status !== "completed" || r?.home_score == null || r?.away_score == null) continue;

    for (const [team, ours, theirs] of [
      [home, r.home_score, r.away_score],
      [away, r.away_score, r.home_score],
    ] as [any, number, number][]) {
      if (!team?.team_id) continue;
      const key = `${f.competition_id}|${team.team_id}`;
      const row = table.get(key) ?? {
        team_id: team.team_id, team_name: team.name, logo_url: team.logo_url ?? null,
        competition_id: f.competition_id, competition_name: one<any>(f.competition)?.name ?? "",
        played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, goal_difference: 0, league_points: 0,
      };
      row.played++;
      row.points_for += ours;
      row.points_against += theirs;
      if (ours > theirs) row.won++;
      else if (ours < theirs) row.lost++;
      else row.drawn++;
      row.goal_difference = row.points_for - row.points_against;
      row.league_points = row.won * 3 + row.drawn;
      table.set(key, row);
    }
  }

  const rows = Array.from(table.values()).sort(
    (a, b) =>
      b.league_points - a.league_points ||
      b.goal_difference - a.goal_difference ||
      b.points_for - a.points_for ||
      a.team_name.localeCompare(b.team_name)
  );
  return { rows, playoffs };
}
