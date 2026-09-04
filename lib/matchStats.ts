// ----------------------------------------------------------------------
// Match event vocabulary + per-team tallies.
//
// Two entry surfaces write events with slightly different type names:
//   /enter/events  → penalty, try_assist, line_break, sin_bin
//   admin results  → penalty_goal, clean_break, tackle_break, missed_conversion
// Both are handled here so the public match centre reads the same either way.
// ----------------------------------------------------------------------

/**
 * The columns a fixture needs to render as a MatchCard — crests, the score,
 * and every field LiveClock reads. Shared so a page that lists fixtures does
 * not quietly omit one of the clock fields and end up with a card that
 * renders fine but never ticks.
 */
export const FIXTURE_SELECT =
  "fixture_id, scheduled_date, scheduled_time, round, status, home:home_team_id(team_id, name, logo_url), away:away_team_id(team_id, name, logo_url), venue:venue_id(name), competition:competition_id(name, season, division), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id";

export const EVENT_LABELS: Record<string, string> = {
  try: "Try",
  try_assist: "Try Assist",
  conversion: "Conversion",
  missed_conversion: "Missed Conversion",
  penalty: "Penalty Goal",
  penalty_goal: "Penalty Goal",
  drop_goal: "Drop Goal",
  yellow_card: "Yellow Card",
  red_card: "Red Card",
  sin_bin: "Sin Bin",
  line_break: "Line Break",
  clean_break: "Line Break",
  tackle_break: "Tackle Break",
  offload: "Offload",
  metres_gained: "Metres Gained",
  tackle: "Tackle",
  missed_tackle: "Missed Tackle",
  turnover_won: "Turnover Won",
  completed_set: "Completed Set",
  sub_on: "Substituted on",
  sub_off: "Substituted off",
};

/** Points each scoring event is worth in Rugby League. */
export const EVENT_POINTS: Record<string, number> = {
  try: 4,
  conversion: 2,
  penalty: 2,
  penalty_goal: 2,
  drop_goal: 1,
};

/** Events worth showing on the match timeline — the rest are volume stats. */
export const TIMELINE_EVENTS = new Set([
  "try",
  "conversion",
  "penalty",
  "penalty_goal",
  "drop_goal",
  "yellow_card",
  "red_card",
  "sin_bin",
  // A substitution is a moment in the match, so it belongs on the timeline
  // even though it changes no score.
  "sub_on",
  "sub_off",
]);

/** Rows of the home-vs-away stat comparison, in display order. */
export const TEAM_STAT_ROWS: { keys: string[]; label: string }[] = [
  { keys: ["try"], label: "Tries" },
  { keys: ["conversion"], label: "Conversions" },
  { keys: ["penalty", "penalty_goal"], label: "Penalty Goals" },
  { keys: ["drop_goal"], label: "Drop Goals" },
  { keys: ["try_assist"], label: "Try Assists" },
  { keys: ["line_break", "clean_break"], label: "Line Breaks" },
  { keys: ["tackle_break"], label: "Tackle Breaks" },
  { keys: ["offload"], label: "Offloads" },
  { keys: ["tackle"], label: "Tackles" },
  { keys: ["missed_tackle"], label: "Missed Tackles" },
  { keys: ["turnover_won"], label: "Turnovers Won" },
  { keys: ["completed_set"], label: "Completed Sets" },
  { keys: ["yellow_card", "sin_bin"], label: "Yellow / Sin Bin" },
  { keys: ["red_card"], label: "Red Cards" },
  { keys: ["sub_on"], label: "Substitutions" },
];

/** Normalise a stored event_type — older rows were saved title-cased. */
export function normaliseType(type: string | null | undefined): string {
  return (type ?? "").toLowerCase();
}

export function eventLabel(type: string | null | undefined): string {
  const key = normaliseType(type);
  if (EVENT_LABELS[key]) return EVENT_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type StatMap = Record<string, number>;

/** Count events by normalised type. */
export function tally(events: { event_type?: string | null }[]): StatMap {
  const out: StatMap = {};
  for (const e of events) {
    const key = normaliseType(e.event_type);
    if (!key) continue;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Sum a stat row's aliases (e.g. penalty + penalty_goal) out of a tally. */
export function statValue(stats: StatMap, keys: string[]): number {
  return keys.reduce((sum, k) => sum + (stats[k] ?? 0), 0);
}

/** Points scored from a list of events — used when no result row exists yet. */
export function pointsFrom(events: { event_type?: string | null }[]): number {
  return events.reduce(
    (sum, e) => sum + (EVENT_POINTS[normaliseType(e.event_type)] ?? 0),
    0
  );
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtShortDate(d: string | null | undefined): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/**
 * Orders events as the match ran, not as they were typed.
 *
 * A recorder catching up enters the ninth minute during the twelfth, so
 * insertion order is not match order. Sorting on the half first was worse
 * still: an event whose minute was corrected back to 9 kept the half the
 * clock was in when it was typed, and 180 events carry no half at all, which
 * put them after everything else however early they happened.
 *
 * The minute is the fact worth trusting — it runs 0 to 80 across the whole
 * match — so it leads, and the half only separates two events sharing one.
 */
export function byMatchTime(
  a: { minute?: number | null; half?: number | null },
  b: { minute?: number | null; half?: number | null }
): number {
  const am = a.minute ?? null;
  const bm = b.minute ?? null;

  // An event with no minute cannot be placed in the match, so it sits at the
  // end rather than pretending to belong at the start.
  if (am === null && bm === null) return 0;
  if (am === null) return 1;
  if (bm === null) return -1;
  if (am !== bm) return am - bm;

  return (a.half ?? 0) - (b.half ?? 0);
}

/** Which half a minute falls in. Rugby league is two forties. */
export function halfForMinute(minute: number): 1 | 2 {
  return minute > 40 ? 2 : 1;
}

/**
 * The counting stats — the ones that happen too fast to time.
 *
 * A tackle is made and the next is under way before anyone could type a
 * minute, so these are recorded as a count and carry no minute at all. A
 * made-up minute would be worse than none: it would put them in the
 * timeline, and it would make a player's match read as though every tackle
 * happened in the seventeenth.
 *
 * Tries, conversions, missed conversions and cards are the opposite — there
 * is a pause after each one, and when they happened is the point.
 */
export const UNTIMED_EVENTS = new Set([
  "tackle",
  "missed_tackle",
  "tackle_break",
  "line_break",
  "clean_break",
  "offload",
  "turnover_won",
  "completed_set",
  "metres_gained",
]);

/** Whether this kind of event is worth a minute. */
export function carriesMinute(type: string | null | undefined): boolean {
  return !UNTIMED_EVENTS.has(normaliseType(type));
}
