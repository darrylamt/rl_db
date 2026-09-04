import type { SupabaseClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------------
// Appearance counting.
//
// A player has "played" a match when they were named in the match_lineups
// squad for a fixture that has kicked off, OR when they have any recorded
// match_event for it. Lineups are the important half: most fixtures are
// entered with a squad long before anyone records per-player events, so
// counting events alone leaves every appearance at zero.
// ----------------------------------------------------------------------

const KICKED_OFF = new Set(["live", "completed"]);

/** Supabase types to-one FK embeds as `T | T[]` — normalise to a plain object. */
export function embedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Fixture columns every appearance-aware screen needs, as a PostgREST embed. */
export const APPEARANCE_FIXTURE_EMBED =
  "fixture:fixture_id(fixture_id, status, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season, division), result:match_results(home_score, away_score))";

/**
 * True once a match has actually been played. Being named in the squad for a
 * future fixture must not inflate the count — but a fixture whose status was
 * never moved off "scheduled" still counts if a non-zero score was recorded.
 */
export function hasKickedOff(fixture: any): boolean {
  if (!fixture) return false;
  if (KICKED_OFF.has(fixture.status)) return true;
  const result = embedded<any>(fixture.result);
  return (
    !!result && ((result.home_score ?? 0) > 0 || (result.away_score ?? 0) > 0)
  );
}

/** Squad selections for a player, limited to fixtures that have kicked off. */
export async function fetchLineupAppearances(
  supabase: SupabaseClient,
  playerId: string
): Promise<{ lineup_id: string; is_starter: boolean; fixture: any }[]> {
  const { data } = await supabase
    .from("match_lineups")
    .select(`lineup_id, is_starter, ${APPEARANCE_FIXTURE_EMBED}`)
    .eq("player_id", playerId);

  return (data ?? [])
    .map((row: any) => ({ ...row, fixture: embedded<any>(row.fixture) }))
    .filter((row: any) => hasKickedOff(row.fixture));
}
