import { normaliseType } from "@/lib/matchStats";
import { positionGroup } from "@/lib/positions";

/**
 * A match rating worked out from what a player actually did.
 *
 * Ratings were a number somebody typed in, which meant most players never
 * got one. Every event is already recorded against a player, so the rating
 * can be read out of the match rather than remembered after it.
 *
 * Three things shape the design.
 *
 * It starts at 6.0 — a player who did nothing notable had an ordinary game,
 * not a bad one. Only what is on record moves it, in either direction.
 *
 * A back and a forward are not doing the same job, so the same tackle count
 * cannot be worth the same to both. A prop making 30 tackles is doing their
 * job; a winger making 30 has spent the game defending, which is unusual and
 * worth more. The weights below say what each role is expected to produce,
 * and a player is measured against that rather than against everyone.
 *
 * And it is honest about thin evidence. A match where nothing but tries was
 * recorded cannot separate a good game from a quiet one, so the rating stays
 * near 6 and says so — see `confidence`.
 */

export type RatedEvent = { event_type?: string | null };

/** What one of each event is worth, before the role weighting. */
const CREDIT: Record<string, number> = {
  // Scoring — the clearest evidence there is.
  try: 1.2,
  try_assist: 0.8,
  conversion: 0.35,
  penalty_goal: 0.35,
  drop_goal: 0.5,

  // Attacking work that does not show on the scoreboard.
  line_break: 0.45,
  clean_break: 0.45,
  tackle_break: 0.2,
  offload: 0.2,

  // Defence and control.
  tackle: 0.06,
  turnover_won: 0.4,
  completed_set: 0.05,

  // Costs. A missed kick is a smaller fault than a missed tackle, because
  // only the goal kicker is ever charged with one.
  missed_tackle: -0.18,
  missed_conversion: -0.12,
  sin_bin: -0.8,
  yellow_card: -0.8,
  red_card: -2.5,
};

/**
 * How much each role's contributions count.
 *
 * A number above 1 means the role is not expected to produce much of that,
 * so each one says more about the player. Below 1 means it is their day job
 * and a high count is normal rather than remarkable.
 */
const ROLE_WEIGHT: Record<"back" | "forward" | "utility", Record<string, number>> = {
  back: {
    tackle: 1.6,
    missed_tackle: 1.0,
    completed_set: 0.8,
    try: 0.9,
    line_break: 1.0,
    clean_break: 1.0,
    offload: 1.0,
    conversion: 1.0,
    penalty_goal: 1.0,
    drop_goal: 1.0,
  },
  forward: {
    tackle: 0.8,
    missed_tackle: 1.3,
    completed_set: 1.2,
    // A forward crossing the line has beaten the part of the field where it
    // is hardest to.
    try: 1.3,
    line_break: 1.4,
    clean_break: 1.4,
    offload: 1.4,
    conversion: 1.2,
    penalty_goal: 1.2,
    drop_goal: 1.2,
  },
  utility: {},
};

/** Ratings live on a 1–10 scale, and the table enforces it. */
const FLOOR = 1;
const CEILING = 10;
const BASELINE = 6;

export type Rating = {
  /** 1.0 to 10.0, to one decimal. */
  rating: number;
  /**
   * How much the events actually support it: "good", "thin" when little was
   * recorded, or "none" when the player has no events at all.
   */
  confidence: "good" | "thin" | "none";
  /** The events that moved it most, best first — for showing the working. */
  reasons: { label: string; count: number; effect: number }[];
};

const LABEL: Record<string, string> = {
  try: "Tries",
  try_assist: "Try assists",
  conversion: "Conversions",
  penalty_goal: "Penalty goals",
  drop_goal: "Drop goals",
  line_break: "Line breaks",
  clean_break: "Line breaks",
  tackle_break: "Tackle breaks",
  offload: "Offloads",
  tackle: "Tackles",
  turnover_won: "Turnovers won",
  completed_set: "Completed sets",
  missed_tackle: "Missed tackles",
  missed_conversion: "Missed conversions",
  sin_bin: "Sin bin",
  yellow_card: "Yellow card",
  red_card: "Red card",
};

/**
 * Rates one player's match from their events.
 *
 * `position` decides the role weighting; without one the player is treated
 * as a utility and no role adjustment is applied, which is the neutral
 * choice rather than a guess.
 */
export function rateMatch(
  events: RatedEvent[],
  position?: string | null
): Rating {
  const group = positionGroup(position ?? "") ?? "utility";
  const weights = ROLE_WEIGHT[group];

  const counts = new Map<string, number>();
  for (const e of events) {
    const t = normaliseType(e.event_type);
    if (!(t in CREDIT)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return { rating: BASELINE, confidence: "none", reasons: [] };
  }

  const reasons: Rating["reasons"] = [];
  let total = 0;

  Array.from(counts).forEach(([type, count]) => {
    const effect = CREDIT[type] * (weights[type] ?? 1) * count;
    total += effect;
    reasons.push({ label: LABEL[type] ?? type, count, effect });
  });

  // Diminishing returns. Without this a player credited with 60 tackles runs
  // away with a 10, and the difference between 40 tackles and 60 is far less
  // than the difference between 0 and 20.
  const damped = Math.sign(total) * Math.pow(Math.abs(total), 0.75);

  const rating = Math.min(
    CEILING,
    Math.max(FLOOR, Math.round((BASELINE + damped) * 10) / 10)
  );

  // Tries alone cannot tell a good game from a quiet one. "Thin" means the
  // number is defensible but built on very little.
  const recorded = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const confidence: Rating["confidence"] = recorded >= 5 ? "good" : "thin";

  reasons.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));

  return { rating, confidence, reasons };
}

/** The words that go with a number, for a scoreboard or a profile. */
export function ratingLabel(rating: number): string {
  if (rating >= 9) return "Outstanding";
  if (rating >= 8) return "Excellent";
  if (rating >= 7) return "Strong";
  if (rating >= 6) return "Solid";
  if (rating >= 5) return "Quiet";
  return "Poor";
}
