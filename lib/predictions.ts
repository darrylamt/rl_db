import { createAdminClient } from "@/lib/supabase/server";

export type PredictionCounts = { home: number; away: number };

/**
 * Vote counts for one fixture. Reads via the service role, like the write
 * side — match_predictions has no anon policies, so a page using the public
 * client would just see nothing.
 *
 * Returns zeros rather than throwing when the migration hasn't run yet
 * (supabase/match_predictions.sql), the same tolerance the rest of the app
 * gives a column or table that is ahead of the database.
 */
export async function getPredictionCounts(
  fixtureId: string
): Promise<PredictionCounts> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("match_predictions")
    .select("choice")
    .eq("fixture_id", fixtureId);

  if (error || !data) return { home: 0, away: 0 };

  let home = 0;
  let away = 0;
  for (const row of data as any[]) {
    if (row.choice === "home") home++;
    else if (row.choice === "away") away++;
  }
  return { home, away };
}
