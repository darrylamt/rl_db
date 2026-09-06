import { createAdminClient } from "@/lib/supabase/server";

/**
 * Which season it is, and whether it has finished.
 *
 * The federation states when a season runs; nothing here infers it. A season
 * holds several tournaments that end at different times, so there is no
 * single competition end date to read — and a boundary derived from fixtures
 * would move every time one was entered.
 *
 * Until the table exists and has rows, this falls back to the calendar year,
 * which is exactly how the budget system behaved before. A migration that
 * has not been run should never stop clubs trading.
 */

export type Season = {
  season: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

export type SeasonState = {
  /** The season budgets are granted against. */
  season: string;
  /** The row it came from, when it came from one. */
  row: Season | null;
  /** True when today is past its end date — the next season's grant is due. */
  ended: boolean;
  /** True when nobody is between seasons: today sits inside one. */
  running: boolean;
  /** The season that follows, once this one has finished. */
  next: Season | null;
  every: Season[];
  /** True when the calendar year is standing in for a real answer. */
  fallback: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

/** The calendar year — what a season was before the federation could say. */
export function calendarSeason(): string {
  return String(new Date().getFullYear());
}

export async function getSeasons(): Promise<Season[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("season, starts_on, ends_on, note")
    .order("starts_on", { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    season: r.season,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    note: r.note,
  }));
}

/**
 * Works out where today sits.
 *
 * Three cases, in the order they are checked. Today falls inside a season, so
 * that is the season and it is running. Or every season has finished, so the
 * most recent one is still the season of record but it has ended and the next
 * grant is due. Or the only seasons are in the future, so the earliest of
 * them is next and there is nothing to grant against yet.
 *
 * Gaps between seasons are the ordinary case, not an error: the rugby stops
 * in October and starts again in April, and the months between belong to the
 * season that just finished until the federation opens the next one.
 */
export async function getSeasonState(): Promise<SeasonState> {
  const every = await getSeasons();
  const day = today();

  if (every.length === 0) {
    return {
      season: calendarSeason(),
      row: null,
      ended: false,
      running: true,
      next: null,
      every: [],
      fallback: true,
    };
  }

  // Oldest first is easier to reason about than the order they arrive in.
  const byDate = [...every].sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  const running = byDate.find((s) => s.startsOn <= day && day <= s.endsOn);
  if (running) {
    const next = byDate.find((s) => s.startsOn > running.endsOn) ?? null;
    return {
      season: running.season,
      row: running,
      ended: false,
      running: true,
      next,
      every,
      fallback: false,
    };
  }

  const finished = byDate.filter((s) => s.endsOn < day);
  if (finished.length > 0) {
    const last = finished[finished.length - 1];
    const next = byDate.find((s) => s.startsOn > day) ?? null;
    return {
      season: last.season,
      row: last,
      ended: true,
      running: false,
      next,
      every,
      fallback: false,
    };
  }

  // Everything is still ahead of us.
  const first = byDate[0];
  return {
    season: first.season,
    row: first,
    ended: false,
    running: false,
    next: first,
    every,
    fallback: false,
  };
}

/** The season to stamp on a ledger entry written right now. */
export async function seasonForWriting(): Promise<string> {
  return (await getSeasonState()).season;
}
