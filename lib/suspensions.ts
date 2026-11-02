import { createPublicClient } from "@/lib/supabase/server";

/**
 * Active suspensions in force today, by player: { until, matches }. A ban
 * with no end date runs until the federation closes it.
 */
export async function currentSuspensions(
  supabase: ReturnType<typeof createPublicClient>,
  playerIds: string[]
): Promise<Map<string, { until: string | null; matches: number | null }>> {
  const out = new Map<string, { until: string | null; matches: number | null }>();
  if (!playerIds.length) return out;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("suspensions")
    .select("player_id, start_date, end_date, matches_banned")
    .eq("status", "active")
    .in("player_id", playerIds);
  if (error || !data) return out;
  for (const s of data as any[]) {
    if (s.start_date && s.start_date > today) continue;
    if (s.end_date && s.end_date < today) continue;
    const prev = out.get(s.player_id);
    // Two bans at once: the later end is the one that matters.
    if (!prev || (s.end_date ?? "9999") > (prev.until ?? "9999")) {
      out.set(s.player_id, { until: s.end_date ?? null, matches: s.matches_banned ?? null });
    }
  }
  return out;
}
