import { createAdminClient } from "@/lib/supabase/server";
import { normaliseType, EVENT_POINTS } from "@/lib/matchStats";

/**
 * What a player is worth, worked out from what has actually been recorded.
 *
 * Derived on read, never stored — the same rule the record book follows. A
 * kept figure drifts the moment a try is re-attributed or a position is
 * finally entered, and this model depends on both. Enter a position and the
 * value moves on the next page load; nothing to run, nothing to backfill.
 *
 * This is a rating, not a market price. A market price comes from managers
 * buying and selling, and there is no game yet — when there is, price becomes
 * a slow, capped, stored number that starts here and then moves on demand.
 * Keeping the two apart is what stops one big afternoon farming the economy.
 *
 * Everything is a percentile inside the player's own position group, so the
 * scale never breaks when a metric is added: the weights renormalise and
 * everybody is still scored nought to one against their peers.
 */

export type ValueGroup = "spine" | "outside" | "forward" | "utility";

export type Driver = { label: string; percentile: number; weight: number };

export type Valuation = {
  value: number;
  /** 0–1 against peers, before the base is applied. */
  score: number;
  base: number;
  group: ValueGroup;
  appearances: number;
  points: number;
  pointsPerAppearance: number;
  confidence: "none" | "low" | "fair" | "good";
  /** What moved it, for showing a player. Age is deliberately not in here. */
  drivers: Driver[];
};

/**
 * The floor each position starts from.
 *
 * A hooker, a half or a fullback touches the ball far more than a prop does,
 * so a model built on scoring alone would leave every forward permanently
 * worthless. The floor is the correction: forwards start lower on the scoring
 * metrics and higher on the base, and end up in the same conversation.
 */
const GROUP_OF: Record<string, ValueGroup> = {
  Hooker: "spine",
  "Scrum-half": "spine",
  "Stand-off": "spine",
  Fullback: "spine",
  Wing: "outside",
  Centre: "outside",
  Prop: "forward",
  "Second-row": "forward",
  "Loose forward": "forward",
  Utility: "utility",
};

const BASE: Record<ValueGroup, number> = {
  spine: 60,
  outside: 52,
  forward: 46,
  utility: 50,
};

/** How far the best player sits above somebody with nothing recorded. */
const SPREAD = 1.5;

/**
 * Weights, summing to one. Add a metric here and rebalance; nothing else
 * needs to change, because a metric a player has no data for is dropped and
 * the rest renormalise around it.
 *
 * Minutes, starts and discipline are missing on purpose: no substitution has
 * ever been recorded, so there are no minutes to divide by, and 94% of
 * team-sheet rows say "starter" because that is the default rather than a
 * decision. Weighting either today would be weighting noise.
 */
const WEIGHTS = {
  points: 0.42,
  appearances: 0.38,
  team: 0.14,
  age: 0.06,
} as const;

/** Labels for what a player is shown. Age is held back deliberately. */
const PUBLIC_DRIVERS: Record<string, string> = {
  points: "Scoring",
  appearances: "Game time",
  team: "Team strength",
};

/**
 * How much evidence it takes before a player's own rate outweighs his
 * position's average. Median appearances is five, so five is the point at
 * which somebody is judged half on himself and half on his peers — and one
 * try in one game stops making anybody the best player in the country.
 */
const SHRINK = 5;

/** A group needs this many players before ranking inside it means anything. */
const MIN_COHORT = 8;

function groupOf(position: string | null | undefined): ValueGroup {
  if (!position) return "utility";
  return GROUP_OF[position] ?? "utility";
}

/**
 * Rank within a cohort, nought to one, ties sharing a place. A cohort of one
 * sits in the middle: being the only person measured says nothing.
 */
function percentiles(values: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const entries = Array.from(values);
  if (entries.length === 0) return out;
  if (entries.length === 1) {
    out.set(entries[0][0], 0.5);
    return out;
  }
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  // Ties take the average of the places they span, so ten players on zero all
  // get the same number instead of one of them being ranked above the others.
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j++;
    const rank = (i + j) / 2;
    for (let k = i; k <= j; k++) out.set(sorted[k][0], rank / (n - 1));
    i = j + 1;
  }
  return out;
}

/** Peak years get the most; either side of them tails off gently. */
function primeScore(age: number | null): number | null {
  if (age == null || age < 14 || age > 50) return null;
  return Math.max(0, 1 - Math.abs(age - 26) / 12);
}

function confidenceOf(appearances: number): Valuation["confidence"] {
  if (appearances === 0) return "none";
  if (appearances <= 3) return "low";
  if (appearances <= 9) return "fair";
  return "good";
}

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

export async function getPlayerValues(): Promise<Map<string, Valuation>> {
  const supabase = createAdminClient();

  // The admin client on purpose: date of birth is not on the public view and
  // should not be. It is read here, used, and never returned.
  const [players, events, lineups, fixtures, results] = await Promise.all([
    all<any>(supabase, "players", "player_id, position, team_id, date_of_birth"),
    all<any>(supabase, "match_events", "player_id, fixture_id, event_type"),
    all<any>(supabase, "match_lineups", "player_id, fixture_id"),
    all<any>(supabase, "fixtures", "fixture_id, home_team_id, away_team_id"),
    all<any>(supabase, "match_results", "fixture_id, home_score, away_score"),
  ]);

  // ── What each player has actually done ──
  const points = new Map<string, number>();
  const played = new Map<string, Set<string>>();

  const seen = (id: string) => {
    if (!played.has(id)) played.set(id, new Set());
    return played.get(id)!;
  };

  for (const e of events) {
    if (!e.player_id) continue;
    const p = EVENT_POINTS[normaliseType(e.event_type)] ?? 0;
    points.set(e.player_id, (points.get(e.player_id) ?? 0) + p);
    // An event is proof of playing; team sheets only exist from 2024.
    if (e.fixture_id) seen(e.player_id).add(e.fixture_id);
  }
  for (const l of lineups) {
    if (!l.player_id || !l.fixture_id) continue;
    seen(l.player_id).add(l.fixture_id);
  }

  // ── How strong the club around them is ──
  const fixtureById = new Map(fixtures.map((f) => [f.fixture_id, f]));
  const clubWins = new Map<string, number>();
  const clubPlayed = new Map<string, number>();
  for (const r of results) {
    const f = fixtureById.get(r.fixture_id);
    if (!f || r.home_score == null || r.away_score == null) continue;
    for (const [side, ours, theirs] of [
      [f.home_team_id, r.home_score, r.away_score],
      [f.away_team_id, r.away_score, r.home_score],
    ] as [string, number, number][]) {
      if (!side) continue;
      clubPlayed.set(side, (clubPlayed.get(side) ?? 0) + 1);
      if (ours > theirs) clubWins.set(side, (clubWins.get(side) ?? 0) + 1);
    }
  }
  const clubStrength = new Map<string, number>();
  for (const [club, n] of Array.from(clubPlayed)) {
    if (n < 3) continue; // three matches is not a season
    clubStrength.set(club, (clubWins.get(club) ?? 0) / n);
  }

  // ── Group everybody, then rank inside the group ──
  type Row = {
    id: string;
    group: ValueGroup;
    apps: number;
    pts: number;
    rate: number;
    team: string | null;
    age: number | null;
  };

  const rows: Row[] = players.map((p): Row => {
    const apps = played.get(p.player_id)?.size ?? 0;
    const pts = points.get(p.player_id) ?? 0;
    return {
      id: p.player_id as string,
      group: groupOf(p.position),
      apps,
      pts,
      rate: apps > 0 ? pts / apps : 0,
      team: p.team_id as string | null,
      age: p.date_of_birth
        ? Math.floor(
            (Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000
          )
        : null,
    };
  });

  const byGroup = new Map<ValueGroup, Row[]>();
  for (const r of rows) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push(r);
  }

  const out = new Map<string, Valuation>();

  for (const [group, cohortRaw] of Array.from(byGroup)) {
    // A group too small to rank inside is ranked against everybody instead.
    // Only 106 of 525 players have a position, so most sit in "utility" for
    // now and move into their real group the day somebody enters one.
    const cohort = cohortRaw.length >= MIN_COHORT ? cohortRaw : rows;

    // Shrunk scoring rate: a player's own number, pulled toward his peers'
    // in proportion to how little evidence stands behind it.
    const rated = cohort.filter((r: Row) => r.apps > 0);
    const cohortRate =
      rated.length > 0
        ? rated.reduce((sum: number, r: Row) => sum + r.rate, 0) / rated.length
        : 0;

    const shrunk = new Map<string, number>();
    const appsMap = new Map<string, number>();
    const teamMap = new Map<string, number>();
    const ageMap = new Map<string, number>();

    for (const r of cohort) {
      shrunk.set(r.id, (r.pts + SHRINK * cohortRate) / (r.apps + SHRINK));
      appsMap.set(r.id, r.apps);
      const strength = r.team ? clubStrength.get(r.team) : undefined;
      if (strength != null) teamMap.set(r.id, strength);
      const prime = primeScore(r.age);
      if (prime != null) ageMap.set(r.id, prime);
    }

    const pPoints = percentiles(shrunk);
    const pApps = percentiles(appsMap);
    const pTeam = percentiles(teamMap);
    const pAge = percentiles(ageMap);

    for (const r of cohortRaw) {
      const parts: { key: keyof typeof WEIGHTS; pct: number }[] = [];
      const pts = pPoints.get(r.id);
      const apps = pApps.get(r.id);
      const team = pTeam.get(r.id);
      const age = pAge.get(r.id);
      if (pts != null) parts.push({ key: "points", pct: pts });
      if (apps != null) parts.push({ key: "appearances", pct: apps });
      if (team != null) parts.push({ key: "team", pct: team });
      if (age != null) parts.push({ key: "age", pct: age });

      // Metrics a player has no data for drop out and the rest renormalise,
      // so a missing date of birth costs nobody anything.
      const total = parts.reduce((s, p) => s + WEIGHTS[p.key], 0);
      const score =
        total > 0
          ? parts.reduce((s, p) => s + (WEIGHTS[p.key] / total) * p.pct, 0)
          : 0;

      const base = BASE[r.group as ValueGroup];
      out.set(r.id, {
        value: Math.round(base * (1 + SPREAD * score)),
        score,
        base,
        group: r.group,
        appearances: r.apps,
        points: r.pts,
        pointsPerAppearance: r.apps > 0 ? r.pts / r.apps : 0,
        confidence: confidenceOf(r.apps),
        drivers: parts
          .filter((p) => PUBLIC_DRIVERS[p.key])
          .map((p) => ({
            label: PUBLIC_DRIVERS[p.key],
            percentile: p.pct,
            weight: WEIGHTS[p.key] / total,
          })),
      });
    }
  }

  return out;
}

/** One player, when the whole league is not needed by the caller. */
export async function getPlayerValue(
  playerId: string
): Promise<Valuation | null> {
  return (await getPlayerValues()).get(playerId) ?? null;
}
