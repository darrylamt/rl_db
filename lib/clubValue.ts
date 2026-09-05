import { createAdminClient } from "@/lib/supabase/server";
import { getPlayerValues } from "@/lib/playerValue";

/**
 * What a club is worth to the game, not what its first team did last Sunday.
 *
 * This is deliberately a view of club health rather than a form table. A club
 * running men's, women's and youth sides for seven straight seasons is doing
 * more for the sport than one that entered a men's team twice and won a few,
 * and the weights say so. Results matter least of the four.
 *
 * Scored against fixed anchors rather than against each other. There are six
 * public clubs, and a percentile across six is a six-step ladder whose gaps
 * come from there being six of them — not from any real distance. A win rate
 * is already nought to one; grades fielded is out of three; seasons is out of
 * the longest run anybody has. Those mean something on their own.
 */

export type ClubValue = {
  teamId: string;
  name: string;
  value: number;
  score: number;
  parts: {
    breadth: number;
    squad: number;
    continuity: number;
    record: number;
  };
  gradesFielded: string[];
  seasons: number;
  played: number;
  won: number;
  squadSize: number;
};

/**
 * Health first, results last.
 *
 * Pipeline is missing on purpose. Seven players in the whole register have
 * appeared in both a youth and a men's fixture, and the two biggest youth
 * setups account for none of them — weighting it would punish the clubs doing
 * the most development for the fact that nobody has recorded the progression
 * yet. It goes in when that is being written down.
 */
const WEIGHTS = {
  breadth: 0.32,
  squad: 0.28,
  continuity: 0.22,
  record: 0.18,
} as const;

/** A club at its best is worth this much more than one at its floor. */
const BASE = 100;
const SPREAD = 1.5;

/** The side a club can actually put out: thirteen plus a bench. */
const MATCHDAY = 17;

const GRADES = ["senior_men", "senior_women", "youth"] as const;

async function all<T>(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function getClubValues(): Promise<ClubValue[]> {
  const supabase = createAdminClient();

  const [values, teams, players, fixtures, competitions, results] =
    await Promise.all([
      getPlayerValues(),
      all<any>(supabase, "teams", "team_id, name, team_type, is_public"),
      all<any>(supabase, "players", "player_id, team_id, category"),
      all<any>(
        supabase,
        "fixtures",
        "fixture_id, competition_id, home_team_id, away_team_id"
      ),
      all<any>(supabase, "competitions", "competition_id, season, division"),
      all<any>(supabase, "match_results", "fixture_id, home_score, away_score"),
    ]);

  const clubs = teams.filter(
    (t) => t.team_type === "club" && t.is_public !== false
  );

  const compById = new Map(competitions.map((c) => [c.competition_id, c]));
  const resultBy = new Map(results.map((r) => [r.fixture_id, r]));

  const gradeOf = (category: string | null | undefined) => {
    const c = (category ?? "").toLowerCase().replace(/\s+/g, "_");
    if (c === "senior_men" || c === "male" || c === "men") return "senior_men";
    if (c === "senior_women" || c === "female" || c === "women")
      return "senior_women";
    if (c === "youth") return "youth";
    return "unknown";
  };

  /** A competition's division, in the same words the squad uses. */
  const gradeOfDivision = (division: string | null | undefined) => {
    const d = (division ?? "men").toLowerCase();
    if (d === "women") return "senior_women";
    if (d === "youth") return "youth";
    return "senior_men";
  };

  const rows: ClubValue[] = [];

  // The longest run anybody has, so continuity is measured against the most
  // any club could have managed rather than an invented target.
  const seasonsPerClub = new Map<string, Set<string>>();
  for (const f of fixtures) {
    const comp = compById.get(f.competition_id);
    if (!comp?.season) continue;
    for (const side of [f.home_team_id, f.away_team_id]) {
      if (!side) continue;
      if (!seasonsPerClub.has(side)) seasonsPerClub.set(side, new Set());
      seasonsPerClub.get(side)!.add(comp.season);
    }
  }
  const longestRun = Math.max(
    1,
    ...clubs.map((c) => seasonsPerClub.get(c.team_id)?.size ?? 0)
  );

  for (const club of clubs) {
    const squad = players.filter((p) => p.team_id === club.team_id);

    // ── Breadth: which grades they actually field ──
    // Taken from fixtures rather than the register, because a club with
    // juniors on paper that never enters a youth competition is not running
    // a youth setup.
    const fielded = new Set<string>();
    let played = 0;
    let won = 0;
    const perGrade = new Map<string, { played: number; won: number }>();

    for (const f of fixtures) {
      const isHome = f.home_team_id === club.team_id;
      const isAway = f.away_team_id === club.team_id;
      if (!isHome && !isAway) continue;
      const comp = compById.get(f.competition_id);
      const grade = gradeOfDivision(comp?.division);
      const r = resultBy.get(f.fixture_id);
      if (!r || r.home_score == null || r.away_score == null) continue;

      fielded.add(grade);
      const ours = isHome ? r.home_score : r.away_score;
      const theirs = isHome ? r.away_score : r.home_score;
      played += 1;
      if (ours > theirs) won += 1;

      if (!perGrade.has(grade)) perGrade.set(grade, { played: 0, won: 0 });
      const g = perGrade.get(grade)!;
      g.played += 1;
      if (ours > theirs) g.won += 1;
    }

    const breadth = fielded.size / GRADES.length;

    // ── Squad quality: the side they could put out, per grade ──
    // A mean of the best seventeen rather than a sum of everybody, or the
    // club with the most juniors on the register wins before kick-off.
    const gradeQuality: number[] = [];
    for (const grade of GRADES) {
      const inGrade = squad
        .filter((p) => gradeOf(p.category) === grade)
        .map((p) => values.get(p.player_id))
        .filter(Boolean)
        .map((v) => v!.scoreExTeam)
        .sort((a, b) => b - a);
      if (inGrade.length === 0) continue;
      const top = inGrade.slice(0, MATCHDAY);
      gradeQuality.push(top.reduce((s, n) => s + n, 0) / top.length);
    }
    const squadScore =
      gradeQuality.length > 0
        ? gradeQuality.reduce((s, n) => s + n, 0) / gradeQuality.length
        : 0;

    // ── Continuity and record ──
    const seasons = seasonsPerClub.get(club.team_id)?.size ?? 0;
    const continuity = Math.min(1, seasons / longestRun);

    // Averaged over the grades they field, not pooled. A club is not judged
    // worse for entering a women's side that loses than for not entering one
    // at all — breadth already carries that, heavily.
    const gradeRates = Array.from(perGrade.values())
      .filter((g) => g.played >= 3)
      .map((g) => g.won / g.played);
    const record =
      gradeRates.length > 0
        ? gradeRates.reduce((s, n) => s + n, 0) / gradeRates.length
        : 0;

    const score =
      WEIGHTS.breadth * breadth +
      WEIGHTS.squad * squadScore +
      WEIGHTS.continuity * continuity +
      WEIGHTS.record * record;

    rows.push({
      teamId: club.team_id,
      name: club.name,
      value: Math.round(BASE * (1 + SPREAD * score)),
      score,
      parts: { breadth, squad: squadScore, continuity, record },
      gradesFielded: Array.from(fielded),
      seasons,
      played,
      won,
      squadSize: squad.length,
    });
  }

  return rows.sort((a, b) => b.value - a.value);
}
