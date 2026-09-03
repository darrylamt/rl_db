import { createPublicClient } from "@/lib/supabase/server";
import { normaliseType, EVENT_POINTS } from "@/lib/matchStats";

/**
 * The record books.
 *
 * Everything is counted from match_events and match_lineups rather than kept
 * in a table of its own. A stored total drifts the moment an event is
 * corrected, and events here are corrected often — a recorder deletes a try
 * entered twice, the federation fixes a walkover. Counting on read costs a
 * few thousand rows and is never wrong.
 *
 * Season is the competition's season rather than the fixture's date: a
 * competition that runs across a new year still belongs to one season, and
 * that is the number people say out loud.
 */

export type Leader = {
  id: string;
  name: string;
  subtitle: string;
  count: number;
  /** Where they rank, with ties sharing a place. */
  place: number;
  photoUrl?: string | null;
  clubLogo?: string | null;
};

export type RecordBoard = {
  key: string;
  title: string;
  note?: string;
  leaders: Leader[];
};

/** What is worth a table of its own, and what to call it. */
const PLAYER_BOARDS: { key: string; title: string; types: string[]; note?: string }[] = [
  { key: "try", title: "Most tries", types: ["try"] },
  { key: "points", title: "Most points", types: [], note: "Tries, conversions, penalties and drop goals together." },
  { key: "conversion", title: "Most conversions", types: ["conversion"] },
  { key: "tackle", title: "Most tackles", types: ["tackle"] },
  { key: "line_break", title: "Most line breaks", types: ["line_break", "clean_break"] },
  { key: "offload", title: "Most offloads", types: ["offload"] },
  { key: "try_assist", title: "Most try assists", types: ["try_assist"] },
  { key: "appearances", title: "Most appearances", types: [] },
  { key: "cards", title: "Most cards", types: ["yellow_card", "red_card", "sin_bin"], note: "Yellows, reds and sin bins." },
];

/**
 * What was actually played, which only the competition's name records.
 *
 * These are different games rather than different competitions: a 9s try and a
 * 13s try are not the same feat, and eRugby is not played on a field at all.
 * Combined is still the default, because that is the question most people
 * arrive with — but anyone who wants the 13s record book alone can have it.
 */
const FORMATS: { key: string; label: string; match: RegExp }[] = [
  { key: "13s", label: "13s", match: /\b13s\b/i },
  { key: "9s", label: "9s", match: /\b9s\b/i },
  { key: "erugby", label: "eRugby", match: /e-?rugby/i },
  { key: "beach", label: "Beach", match: /beach/i },
  { key: "presidents", label: "President's Cup", match: /president/i },
  { key: "origins", label: "Origins Cup", match: /origins/i },
];

function formatOf(name: string | null | undefined): string | null {
  if (!name) return null;
  return FORMATS.find((f) => f.match.test(name))?.key ?? null;
}

/**
 * Who played it, which the competition already records.
 *
 * The men's game has been recorded since 2019 and the women's and youth games
 * only since 2024, so a combined table is a men's table wearing a hat. Any
 * division the competitions do not use is simply never offered.
 */
const DIVISIONS: { key: string; label: string }[] = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
  { key: "youth", label: "Youth" },
];

export type RecordsData = {
  seasons: string[];
  season: string | null;
  /** Only those a match has actually been played in. */
  formats: { key: string; label: string }[];
  format: string | null;
  divisions: { key: string; label: string }[];
  division: string | null;
  playerBoards: RecordBoard[];
  clubBoards: RecordBoard[];
  /** Single facts rather than tables — the biggest win, the highest score. */
  matchFacts: { label: string; value: string; detail: string }[];
  totals: { label: string; value: number }[];
};

function rank(
  rows: {
    id: string;
    name: string;
    subtitle: string;
    count: number;
    photoUrl?: string | null;
    clubLogo?: string | null;
  }[],
): Leader[] {
  const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  let place = 0;
  let lastCount: number | null = null;
  return sorted.slice(0, 10).map((r, i) => {
    // Equal counts share a place, and the next one down skips — otherwise a
    // three-way tie for first would read as first, second and third.
    if (r.count !== lastCount) {
      place = i + 1;
      lastCount = r.count;
    }
    return { ...r, place };
  });
}

export async function getRecords(
  season?: string | null,
  format?: string | null,
  division?: string | null,
): Promise<RecordsData> {
  const supabase = createPublicClient();

  // Paged, because PostgREST stops at 1000 without a word and these are the
  // tables most likely to pass it.
  const all = async <T,>(table: string, columns: string): Promise<T[]> => {
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
  };

  const [competitions, fixtures, events, lineups, players, teams, results] =
    await Promise.all([
      all<any>("competitions", "competition_id, name, season, division"),
      all<any>("fixtures", "fixture_id, competition_id, home_team_id, away_team_id, scheduled_date"),
      all<any>("match_events", "fixture_id, player_id, team_id, event_type"),
      all<any>("match_lineups", "fixture_id, player_id, team_id"),
      all<any>("players", "player_id, first_name, last_name, team_id, photo_url"),
      all<any>("teams", "team_id, name, logo_url, team_type"),
      all<any>("match_results", "fixture_id, home_score, away_score"),
    ]);

  const seasonOf = new Map<string, string | null>();
  const formatOfComp = new Map<string, string | null>();
  const divisionOf = new Map<string, string | null>();
  for (const c of competitions) {
    seasonOf.set(c.competition_id, c.season ?? null);
    formatOfComp.set(c.competition_id, formatOf(c.name));
    divisionOf.set(c.competition_id, c.division ?? null);
  }

  const fixtureSeason = new Map<string, string | null>();
  const fixtureFormat = new Map<string, string | null>();
  const fixtureDivision = new Map<string, string | null>();
  for (const f of fixtures) {
    fixtureSeason.set(f.fixture_id, seasonOf.get(f.competition_id) ?? null);
    fixtureFormat.set(f.fixture_id, formatOfComp.get(f.competition_id) ?? null);
    fixtureDivision.set(f.fixture_id, divisionOf.get(f.competition_id) ?? null);
  }

  const seasons = Array.from(
    new Set(competitions.map((c) => c.season).filter(Boolean) as string[])
  ).sort((a, b) => b.localeCompare(a));

  // A competition nobody has played in yet is a filter that returns nothing,
  // so it is not offered.
  const played = new Set(fixtures.map((f) => f.competition_id));
  const formatsPlayed = new Set(
    competitions
      .filter((c) => played.has(c.competition_id))
      .map((c) => formatOf(c.name))
      .filter(Boolean) as string[]
  );
  const formats = FORMATS.filter((f) => formatsPlayed.has(f.key)).map((f) => ({
    key: f.key,
    label: f.label,
  }));

  const divisionsPlayed = new Set(
    competitions
      .filter((c) => played.has(c.competition_id))
      .map((c) => c.division)
      .filter(Boolean) as string[]
  );
  const divisions = DIVISIONS.filter((d) => divisionsPlayed.has(d.key)).map(
    (d) => ({ key: d.key, label: d.label })
  );

  const inScope = (fixtureId: string) =>
    (!season || fixtureSeason.get(fixtureId) === season) &&
    (!format || fixtureFormat.get(fixtureId) === format) &&
    (!division || fixtureDivision.get(fixtureId) === division);

  const playerName = new Map(
    players.map((p) => [
      p.player_id,
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed",
    ])
  );
  const teamName = new Map(teams.map((t) => [t.team_id, t.name]));
  const teamLogo = new Map(teams.map((t) => [t.team_id, t.logo_url]));

  // The club tables are between clubs. A national side and a President's XIII
  // are selections drawn from every club in the league, so ranking them
  // alongside is counting the same players a second time and calling them a
  // rival. Their matches still count towards the players who played in them.
  const isClub = new Set(
    teams.filter((t) => t.team_type === "club").map((t) => t.team_id)
  );
  const playerPhoto = new Map(players.map((p) => [p.player_id, p.photo_url]));
  const playerClub = new Map(players.map((p) => [p.player_id, p.team_id]));

  // ── Player tallies ────────────────────────────────────────
  const perPlayer = new Map<string, Map<string, number>>();
  const pointsPer = new Map<string, number>();
  const appearancesPer = new Map<string, Set<string>>();

  for (const e of events) {
    if (!e.player_id || !inScope(e.fixture_id)) continue;
    const t = normaliseType(e.event_type);
    if (!perPlayer.has(e.player_id)) perPlayer.set(e.player_id, new Map());
    const m = perPlayer.get(e.player_id)!;
    m.set(t, (m.get(t) ?? 0) + 1);
    pointsPer.set(e.player_id, (pointsPer.get(e.player_id) ?? 0) + (EVENT_POINTS[t] ?? 0));

    // An event is proof of playing, and line-ups only exist from 2024.
    if (!appearancesPer.has(e.player_id)) appearancesPer.set(e.player_id, new Set());
    appearancesPer.get(e.player_id)!.add(e.fixture_id);
  }
  for (const l of lineups) {
    if (!l.player_id || !inScope(l.fixture_id)) continue;
    if (!appearancesPer.has(l.player_id)) appearancesPer.set(l.player_id, new Set());
    appearancesPer.get(l.player_id)!.add(l.fixture_id);
  }

  const playerRow = (id: string, count: number) => ({
    id,
    name: playerName.get(id) ?? "Unnamed",
    subtitle: teamName.get(playerClub.get(id) ?? "") ?? "No club",
    count,
    photoUrl: playerPhoto.get(id) ?? null,
    clubLogo: teamLogo.get(playerClub.get(id) ?? "") ?? null,
  });

  const playerBoards: RecordBoard[] = PLAYER_BOARDS.map((b) => {
    let rows: { id: string; name: string; subtitle: string; count: number }[];

    if (b.key === "points") {
      rows = Array.from(pointsPer).map(([id, n]) => playerRow(id, n));
    } else if (b.key === "appearances") {
      rows = Array.from(appearancesPer).map(([id, set]) => playerRow(id, set.size));
    } else {
      rows = Array.from(perPlayer).map(([id, m]) => {
        const n = b.types.reduce((sum, t) => sum + (m.get(t) ?? 0), 0);
        return playerRow(id, n);
      });
    }

    return { key: b.key, title: b.title, note: b.note, leaders: rank(rows) };
  }).filter((b) => b.leaders.length > 0);

  // ── Club tallies ──────────────────────────────────────────
  const perClub = new Map<string, Map<string, number>>();
  const clubPoints = new Map<string, number>();
  for (const e of events) {
    const club = e.team_id ?? playerClub.get(e.player_id ?? "") ?? null;
    if (!club || !isClub.has(club) || !inScope(e.fixture_id)) continue;
    const t = normaliseType(e.event_type);
    if (!perClub.has(club)) perClub.set(club, new Map());
    const m = perClub.get(club)!;
    m.set(t, (m.get(t) ?? 0) + 1);
    clubPoints.set(club, (clubPoints.get(club) ?? 0) + (EVENT_POINTS[t] ?? 0));
  }

  // Wins are counted from results rather than events, which is the only
  // place a walkover or an awarded match appears at all.
  const clubWins = new Map<string, number>();
  const clubPlayed = new Map<string, number>();
  for (const r of results) {
    if (!inScope(r.fixture_id)) continue;
    const f = fixtures.find((x) => x.fixture_id === r.fixture_id);
    if (!f || r.home_score == null || r.away_score == null) continue;
    for (const [side, ours, theirs] of [
      [f.home_team_id, r.home_score, r.away_score],
      [f.away_team_id, r.away_score, r.home_score],
    ] as [string, number, number][]) {
      if (!side || !isClub.has(side)) continue;
      clubPlayed.set(side, (clubPlayed.get(side) ?? 0) + 1);
      if (ours > theirs) clubWins.set(side, (clubWins.get(side) ?? 0) + 1);
    }
  }

  const clubRow = (id: string, count: number) => ({
    id,
    name: teamName.get(id) ?? "Unknown club",
    subtitle: "",
    count,
    photoUrl: null,
    clubLogo: teamLogo.get(id) ?? null,
  });

  const clubBoards: RecordBoard[] = [
    { key: "club_wins", title: "Most wins", rows: Array.from(clubWins).map(([id, n]) => clubRow(id, n)) },
    { key: "club_points", title: "Most points scored", rows: Array.from(clubPoints).map(([id, n]) => clubRow(id, n)) },
    {
      key: "club_tries",
      title: "Most tries",
      rows: Array.from(perClub).map(([id, m]) => clubRow(id, m.get("try") ?? 0)),
    },
    { key: "club_played", title: "Most matches played", rows: Array.from(clubPlayed).map(([id, n]) => clubRow(id, n)) },
    {
      key: "club_cards",
      title: "Most cards",
      rows: Array.from(perClub).map(([id, m]) =>
        clubRow(id, (m.get("yellow_card") ?? 0) + (m.get("red_card") ?? 0) + (m.get("sin_bin") ?? 0))
      ),
    },
  ]
    .map((b) => ({ key: b.key, title: b.title, leaders: rank(b.rows) }))
    .filter((b) => b.leaders.length > 0);

  // ── One-off facts ─────────────────────────────────────────
  const matchFacts: RecordsData["matchFacts"] = [];
  let biggestWin: { margin: number; text: string; date: string } | null = null;
  let highestScore: { total: number; text: string; date: string } | null = null;

  for (const r of results) {
    if (!inScope(r.fixture_id) || r.home_score == null || r.away_score == null) continue;
    const f = fixtures.find((x) => x.fixture_id === r.fixture_id);
    if (!f) continue;
    const home = teamName.get(f.home_team_id) ?? "?";
    const away = teamName.get(f.away_team_id) ?? "?";
    const text = `${home} ${r.home_score}–${r.away_score} ${away}`;
    const date = f.scheduled_date ?? "";

    const margin = Math.abs(r.home_score - r.away_score);
    if (!biggestWin || margin > biggestWin.margin) biggestWin = { margin, text, date };

    const total = r.home_score + r.away_score;
    if (!highestScore || total > highestScore.total) highestScore = { total, text, date };
  }

  if (biggestWin) {
    matchFacts.push({
      label: "Biggest winning margin",
      value: `${biggestWin.margin}`,
      detail: `${biggestWin.text}${biggestWin.date ? ` · ${biggestWin.date}` : ""}`,
    });
  }
  if (highestScore) {
    matchFacts.push({
      label: "Highest scoring match",
      value: `${highestScore.total}`,
      detail: `${highestScore.text}${highestScore.date ? ` · ${highestScore.date}` : ""}`,
    });
  }

  const scopedEvents = events.filter((e) => inScope(e.fixture_id));
  const totals = [
    { label: "Matches played", value: results.filter((r) => inScope(r.fixture_id)).length },
    { label: "Tries scored", value: scopedEvents.filter((e) => normaliseType(e.event_type) === "try").length },
    { label: "Points scored", value: scopedEvents.reduce((n, e) => n + (EVENT_POINTS[normaliseType(e.event_type)] ?? 0), 0) },
    { label: "Players involved", value: new Set(scopedEvents.map((e) => e.player_id).filter(Boolean)).size },
  ];

  return {
    seasons,
    season: season ?? null,
    formats,
    format: format ?? null,
    divisions,
    division: division ?? null,
    playerBoards,
    clubBoards,
    matchFacts,
    totals,
  };
}
