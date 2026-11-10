import { wholeTable } from "@/lib/wholeTable";
import { normaliseType } from "@/lib/matchStats";

/**
 * The figures behind the admin's Insights page.
 *
 * Read through the five-minute whole-table cache, so looking at the charts
 * costs the database one read of each table in that time however often the
 * page is opened. A result entered now shows here within five minutes.
 */

export type Grade = "men" | "women" | "youth";
export const GRADES: { key: Grade; label: string }[] = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
  { key: "youth", label: "Youth" },
];

function gradeOfDivision(division: string | null | undefined): Grade {
  const d = (division ?? "men").toLowerCase();
  if (d.startsWith("women")) return "women";
  if (d.startsWith("youth")) return "youth";
  return "men";
}

/** Category first ("senior_men", "Senior Men", "youth"), then gender. */
function gradeOfPlayer(p: { category?: string | null; gender?: string | null }): Grade | null {
  const c = (p.category ?? "").toLowerCase().replace(/\s+/g, "_");
  if (c.startsWith("youth")) return "youth";
  if (c.includes("women")) return "women";
  if (c.includes("men")) return "men";
  const g = (p.gender ?? "").toLowerCase();
  if (g === "female") return "women";
  if (g === "male") return "men";
  return null;
}

/** Points by how they were scored. "penalty" was an older name for a penalty goal. */
const SCORING: { key: string; label: string; points: number }[] = [
  { key: "try", label: "Tries", points: 4 },
  { key: "conversion", label: "Conversions", points: 2 },
  { key: "penalty_goal", label: "Penalty goals", points: 2 },
  { key: "drop_goal", label: "Drop goals", points: 1 },
];
const scoringType = (t: string | null | undefined) => {
  const k = normaliseType(t).replace(/\s+/g, "_");
  return k === "penalty" ? "penalty_goal" : k;
};

export async function getInsights(seasonParam?: string | null) {
  const [fixtures, competitions, results, players, teams, events, lineups, documents] =
    await Promise.all([
      wholeTable<any>("admin", "fixtures", "fixture_id, competition_id, scheduled_date, status"),
      wholeTable<any>("admin", "competitions", "competition_id, season, division"),
      wholeTable<any>("admin", "match_results", "fixture_id, home_score, away_score"),
      wholeTable<any>("admin", "players", "player_id, first_name, last_name, team_id, category, gender, playing_status"),
      wholeTable<any>("admin", "teams", "team_id, name"),
      wholeTable<any>("admin", "match_events", "fixture_id, player_id, event_type"),
      wholeTable<any>("admin", "match_lineups", "fixture_id"),
      wholeTable<any>("admin", "fixture_documents", "fixture_id"),
    ]);

  const competition = new Map<string, any>(competitions.map((c) => [c.competition_id, c]));
  const teamName = new Map<string, string>(teams.map((t) => [t.team_id, t.name]));
  const playerName = new Map<string, string>(
    players.map((p) => [p.player_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed"])
  );

  // Played matches, each with its season and grade.
  const played = fixtures
    .filter((f) => f.status === "completed")
    .map((f) => {
      const c = competition.get(f.competition_id);
      const season = String(c?.season ?? (f.scheduled_date ? String(f.scheduled_date).slice(0, 4) : "")) || null;
      return { id: f.fixture_id as string, season, grade: gradeOfDivision(c?.division) };
    })
    .filter((f) => f.season) as { id: string; season: string; grade: Grade }[];

  const seasons = Array.from(new Set(played.map((f) => f.season))).sort();

  // --- Across every season -------------------------------------------------

  const matchesBySeason = seasons.map((s) => {
    const row: Record<string, number> = { men: 0, women: 0, youth: 0 };
    for (const f of played) if (f.season === s) row[f.grade]++;
    return row;
  });

  // Average points in a match, from the recorded scores.
  const score = new Map<string, number>(
    results
      .filter((r) => r.home_score != null && r.away_score != null)
      .map((r) => [r.fixture_id, Number(r.home_score) + Number(r.away_score)])
  );
  const pointsPerMatch = seasons.map((s) => {
    const totals = played.filter((f) => f.season === s && score.has(f.id)).map((f) => score.get(f.id)!);
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    return { avg: Math.round(avg * 10) / 10, matches: totals.length };
  });

  const playersByGrade: Record<Grade | "unset", number> = { men: 0, women: 0, youth: 0, unset: 0 };
  for (const p of players) playersByGrade[gradeOfPlayer(p) ?? "unset"]++;
  const activePlayers = players.filter((p) => String(p.playing_status ?? "").toLowerCase() === "active").length;

  // Active players on each club's books, biggest squad first.
  const squadCount = new Map<string, number>();
  for (const p of players) {
    if (!p.team_id || String(p.playing_status ?? "").toLowerCase() !== "active") continue;
    squadCount.set(p.team_id, (squadCount.get(p.team_id) ?? 0) + 1);
  }
  const squads = Array.from(squadCount.entries())
    .map(([id, n]) => ({ label: teamName.get(id) ?? "Unknown club", value: n }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  // --- One season ----------------------------------------------------------

  const season =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[seasons.length - 1] ?? null;
  const inSeason = new Set(played.filter((f) => f.season === season).map((f) => f.id));
  const seasonEvents = events.filter((e) => inSeason.has(e.fixture_id));

  const tries = new Map<string, number>();
  const points = new Map<string, number>();
  const byType: Record<string, number> = {};
  for (const e of seasonEvents) {
    const type = scoringType(e.event_type);
    const kind = SCORING.find((s) => s.key === type);
    if (!kind) continue;
    byType[type] = (byType[type] ?? 0) + kind.points;
    if (!e.player_id) continue;
    points.set(e.player_id, (points.get(e.player_id) ?? 0) + kind.points);
    if (type === "try") tries.set(e.player_id, (tries.get(e.player_id) ?? 0) + 1);
  }
  const leaders = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([id, n]) => ({ label: playerName.get(id) ?? "Unknown player", value: n }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 10);

  // How much of each played match is on record.
  const hasSheet = new Set(lineups.map((l) => l.fixture_id));
  const hasEvents = new Set(events.map((e) => e.fixture_id));
  const hasDocs = new Set(documents.map((d) => d.fixture_id));
  const count = (s: Set<string>) => Array.from(inSeason).filter((id) => s.has(id)).length;

  return {
    seasons,
    matchesBySeason,
    pointsPerMatch,
    playersByGrade,
    totalPlayers: players.length,
    activePlayers,
    squads,
    season,
    seasonMatches: inSeason.size,
    topTries: leaders(tries),
    topPoints: leaders(points),
    seasonTries: Array.from(tries.values()).reduce((a, b) => a + b, 0),
    seasonPlayerPoints: Array.from(points.values()).reduce((a, b) => a + b, 0),
    pointsByType: SCORING.map((s) => ({ key: s.key, label: s.label, value: byType[s.key] ?? 0 })),
    records: {
      teamSheets: count(hasSheet),
      events: count(hasEvents),
      matchSheets: count(hasDocs),
    },
  };
}
