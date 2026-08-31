import { createAdminClient } from "@/lib/supabase/server";
import { normaliseType } from "@/lib/matchStats";

/** The things worth topping. Only good ones — nobody needs a badge for missed tackles. */
const TRACKED: { type: string; noun: string; verb: string }[] = [
  { type: "try", noun: "try scorer", verb: "tries" },
  { type: "conversion", noun: "goal kicker", verb: "conversions" },
  { type: "try_assist", noun: "provider", verb: "try assists" },
  { type: "tackle", noun: "tackler", verb: "tackles" },
  { type: "line_break", noun: "line breaker", verb: "line breaks" },
  { type: "tackle_break", noun: "tackle breaker", verb: "tackle breaks" },
  { type: "offload", noun: "offloader", verb: "offloads" },
  { type: "turnover_won", noun: "turnover winner", verb: "turnovers won" },
];

export type Standing = {
  /** "leading try scorer", from TRACKED. */
  title: string;
  /** How many they have. */
  count: number;
  /** "at Bulls" or "in the whole federation". */
  scope: "club" | "federation";
  scopeName: string;
  /** True when nobody else has as many. */
  outright: boolean;
  /** How many share the top, when it is shared. */
  sharedWith: number;
};

/**
 * What this player leads, if anything.
 *
 * Counted across everything on record rather than one season, because a
 * player wants to know where they stand, not where they stood. Ties are
 * reported as ties: telling somebody they lead outright when three others
 * have the same number is the kind of small lie that gets noticed.
 *
 * Reads every event once and counts in memory. At a few thousand rows that
 * is far cheaper than asking the database eight questions twice.
 */
export async function standingsFor(
  playerId: string,
  teamId: string | null
): Promise<Standing[]> {
  const supabase = createAdminClient();

  const [{ data: events }, { data: players }] = await Promise.all([
    supabase.from("match_events").select("player_id, event_type").limit(20000),
    supabase.from("players").select("player_id, team_id").limit(2000),
  ]);

  const teamOf = new Map(
    ((players ?? []) as any[]).map((p) => [p.player_id, p.team_id])
  );

  // event type -> player -> count
  const counts = new Map<string, Map<string, number>>();
  for (const e of ((events ?? []) as any[])) {
    if (!e.player_id) continue;
    const t = normaliseType(e.event_type);
    if (!counts.has(t)) counts.set(t, new Map());
    const m = counts.get(t)!;
    m.set(e.player_id, (m.get(e.player_id) ?? 0) + 1);
  }

  const { data: team } = teamId
    ? await supabase.from("teams").select("name").eq("team_id", teamId).maybeSingle()
    : { data: null };
  const clubName = (team as any)?.name ?? "your club";

  const found: Standing[] = [];

  for (const t of TRACKED) {
    const m = counts.get(t.type);
    const mine = m?.get(playerId) ?? 0;
    if (!m || mine === 0) continue;

    const consider = (scope: "club" | "federation", scopeName: string) => {
      let best = 0;
      let holders = 0;
      for (const [pid, n] of Array.from(m)) {
        if (scope === "club" && teamOf.get(pid) !== teamId) continue;
        if (n > best) {
          best = n;
          holders = 1;
        } else if (n === best) {
          holders += 1;
        }
      }
      if (mine < best) return;
      found.push({
        title: `leading ${t.noun}`,
        count: mine,
        scope,
        scopeName,
        outright: holders === 1,
        sharedWith: holders - 1,
      });
    };

    // Federation first: leading everybody says more than leading a club, and
    // saying both about the same stat is repeating yourself.
    const before = found.length;
    consider("federation", "the federation");
    if (found.length === before && teamId) consider("club", clubName);
  }

  // The rarest thing first — topping the federation beats topping a club,
  // and a bigger number beats a smaller one.
  return found.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "federation" ? -1 : 1;
    return b.count - a.count;
  });
}
