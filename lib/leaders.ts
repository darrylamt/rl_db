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
  /** "top try scorer", from TRACKED. */
  title: string;
  count: number;
  /** All time across the federation, or at one club. */
  scope: "all_time" | "club";
  /** The club's name, when the scope is a club. */
  scopeName: string;
  outright: boolean;
  sharedWith: number;
};

/**
 * What a player leads, if anything.
 *
 * A club standing follows the club the events were recorded against, not
 * where the player is registered today: somebody can be the leading try
 * scorer for Panthers years after leaving them, and that is exactly the
 * thing worth saying.
 *
 * Ties are reported as ties. Telling somebody they lead outright when three
 * others match them is the kind of small lie that gets noticed.
 *
 * Every event is read once and counted in memory — far cheaper at a few
 * thousand rows than asking the database a question per statistic per club.
 */
export async function standingsFor(playerId: string): Promise<Standing[]> {
  const supabase = createAdminClient();

  const [{ data: events }, { data: teams }] = await Promise.all([
    supabase.from("match_events").select("player_id, team_id, event_type").limit(20000),
    supabase.from("teams").select("team_id, name"),
  ]);

  const teamName = new Map(
    ((teams ?? []) as any[]).map((t) => [t.team_id, t.name])
  );

  // type -> player -> count, all time
  const overall = new Map<string, Map<string, number>>();
  // type -> team -> player -> count
  const perClub = new Map<string, Map<string, Map<string, number>>>();

  for (const e of ((events ?? []) as any[])) {
    if (!e.player_id) continue;
    const t = normaliseType(e.event_type);

    if (!overall.has(t)) overall.set(t, new Map());
    const o = overall.get(t)!;
    o.set(e.player_id, (o.get(e.player_id) ?? 0) + 1);

    if (!e.team_id) continue;
    if (!perClub.has(t)) perClub.set(t, new Map());
    const byTeam = perClub.get(t)!;
    if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, new Map());
    const c = byTeam.get(e.team_id)!;
    c.set(e.player_id, (c.get(e.player_id) ?? 0) + 1);
  }

  /** Whether this player tops a tally, and by how much company. */
  const topOf = (tally: Map<string, number>) => {
    const mine = tally.get(playerId) ?? 0;
    if (mine === 0) return null;
    let best = 0;
    let holders = 0;
    for (const n of Array.from(tally.values())) {
      if (n > best) {
        best = n;
        holders = 1;
      } else if (n === best) {
        holders += 1;
      }
    }
    if (mine < best) return null;
    return { count: mine, outright: holders === 1, sharedWith: holders - 1 };
  };

  const found: Standing[] = [];

  for (const t of TRACKED) {
    const all = overall.get(t.type);
    if (!all) continue;

    const top = topOf(all);
    if (top) {
      found.push({
        title: `top ${t.noun}`,
        scope: "all_time",
        scopeName: "",
        ...top,
      });
      // Leading everybody already covers leading any one club.
      continue;
    }

    // Otherwise, every club they top — including ones they have left.
    for (const [teamId, tally] of Array.from(perClub.get(t.type) ?? [])) {
      const clubTop = topOf(tally);
      if (!clubTop) continue;
      found.push({
        title: `top ${t.noun}`,
        scope: "club",
        scopeName: teamName.get(teamId) ?? "their club",
        ...clubTop,
      });
    }
  }

  // All-time first, then the biggest numbers.
  return found.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "all_time" ? -1 : 1;
    return b.count - a.count;
  });
}

/** "top try scorer of all time" / "top try scorer for Panthers". */
export function describeStanding(s: Standing): string {
  const lead = s.outright ? "" : "joint ";
  return s.scope === "all_time"
    ? `${lead}${s.title} of all time`
    : `${lead}${s.title} for ${s.scopeName}`;
}
