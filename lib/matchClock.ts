/**
 * The match clock, worked out from timestamps.
 *
 * Every viewer derives the same minute from the same three facts — when the
 * match kicked off, how long it has been stopped, and whether it is stopped
 * now. Nothing is pushed from the recorder's phone, so a lost signal at the
 * ground does not freeze the clock for everyone watching, and someone
 * opening the page in the seventieth minute sees the seventieth minute.
 */

export type ClockState =
  | "not_started"
  | "running"
  | "paused"
  | "half_time"
  | "finished";

export type MatchClock = {
  kickoff_at?: string | null;
  clock_state?: ClockState | string | null;
  paused_at?: string | null;
  stoppage_seconds?: number | null;
};

/** Rugby league is two halves of forty. */
export const HALF_MINUTES = 40;
export const FULL_MINUTES = 80;

export function clockState(f: MatchClock): ClockState {
  const s = f?.clock_state;
  return s === "running" || s === "paused" || s === "half_time" || s === "finished"
    ? s
    : "not_started";
}

/** Seconds of match time played. Frozen while the clock is stopped. */
export function elapsedSeconds(f: MatchClock, now: number = Date.now()): number {
  const state = clockState(f);
  if (state === "not_started" || !f?.kickoff_at) return 0;

  const kickoff = new Date(f.kickoff_at).getTime();
  if (Number.isNaN(kickoff)) return 0;

  // While stopped, time is measured to the moment it stopped, so the clock
  // holds still rather than running on behind a paused display.
  const stoppedAt = f.paused_at ? new Date(f.paused_at).getTime() : NaN;
  const upTo = !Number.isNaN(stoppedAt) ? stoppedAt : now;

  const stoppage = (f.stoppage_seconds ?? 0) * 1000;
  return Math.max(0, Math.floor((upTo - kickoff - stoppage) / 1000));
}

/** The minute a viewer sees. Minute 1 from the first second, as in football. */
export function displayMinute(f: MatchClock, now: number = Date.now()): number {
  const secs = elapsedSeconds(f, now);
  return secs === 0 ? 0 : Math.floor(secs / 60) + 1;
}

/** Which half the clock is in, by elapsed time. */
export function currentHalf(f: MatchClock, now: number = Date.now()): 1 | 2 {
  return displayMinute(f, now) > HALF_MINUTES ? 2 : 1;
}

/** Short label for a scoreboard: 23', HT, FT. */
export function clockLabel(f: MatchClock, now: number = Date.now()): string {
  const state = clockState(f);
  if (state === "not_started") return "";
  if (state === "finished") return "FT";
  if (state === "half_time") return "HT";
  return `${displayMinute(f, now)}'`;
}

/** mm:ss, for the recorder who wants the detail. */
export function clockTime(f: MatchClock, now: number = Date.now()): string {
  const secs = elapsedSeconds(f, now);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The fields to write when the clock is stopped.
 *
 * Kept here so the entry screen and anything else that stops a clock agree
 * on what stopping means.
 */
export function pauseFields(state: "paused" | "half_time" | "finished") {
  return { clock_state: state, paused_at: new Date().toISOString() };
}

/**
 * The fields to write when the clock starts again.
 *
 * Whatever the clock was stopped for is added to the stoppage total, so the
 * match minute picks up exactly where it left off — the second half carries
 * on from the first rather than restarting.
 */
export function resumeFields(f: MatchClock) {
  const pausedAt = f.paused_at ? new Date(f.paused_at).getTime() : NaN;
  const extra = Number.isNaN(pausedAt)
    ? 0
    : Math.max(0, Math.round((Date.now() - pausedAt) / 1000));
  return {
    clock_state: "running" as const,
    paused_at: null,
    stoppage_seconds: (f.stoppage_seconds ?? 0) + extra,
  };
}

/** A walkover is awarded, not played: the side that turned up wins 30–0. */
export const WALKOVER_SCORE = 30;
