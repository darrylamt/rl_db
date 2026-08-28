"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}
function intOrZero(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}
function intOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// ─── Result actions ───────────────────────────────────────────────────────────

function resultPayload(fd: FormData, fixture_id: string) {
  return {
    fixture_id,
    home_score: intOrZero(fd, "home_score"),
    away_score: intOrZero(fd, "away_score"),
    home_tries: intOrZero(fd, "home_tries"),
    away_tries: intOrZero(fd, "away_tries"),
    home_conversions: intOrZero(fd, "home_conversions"),
    away_conversions: intOrZero(fd, "away_conversions"),
    home_penalties: intOrZero(fd, "home_penalties"),
    away_penalties: intOrZero(fd, "away_penalties"),
    home_drop_goals: intOrZero(fd, "home_drop_goals"),
    away_drop_goals: intOrZero(fd, "away_drop_goals"),
    attendance: intOrNull(fd, "attendance"),
    notes: str(fd, "notes"),
    recorded_by: str(fd, "recorded_by"),
    video_url: str(fd, "video_url"),
  };
}

/**
 * Swap which team is home and which is away.
 *
 * Only two tables carry home/away meaning: the fixture's team columns, and the
 * six paired score columns on the result. Everything else — match events,
 * line-ups, player ratings — stores a team_id, so it follows the team and
 * needs no changes. Standings recompute from the corrected fixture.
 */
export async function swapHomeAway(
  fixture_id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: fixture, error: fixtureError } = await supabase
    .from("fixtures")
    .select("home_team_id, away_team_id, scheduled_date")
    .eq("fixture_id", fixture_id)
    .maybeSingle();
  if (fixtureError) return { ok: false, error: fixtureError.message };
  if (!fixture) return { ok: false, error: "Fixture not found" };

  const { data: result } = await supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals"
    )
    .eq("fixture_id", fixture_id)
    .maybeSingle();

  // The swap itself — this must succeed regardless of whether the optional
  // slug column has been added yet.
  const { error: swapError } = await supabase
    .from("fixtures")
    .update({
      home_team_id: fixture.away_team_id,
      away_team_id: fixture.home_team_id,
    })
    .eq("fixture_id", fixture_id);
  if (swapError) return { ok: false, error: swapError.message };

  if (result) {
    const { error: scoreError } = await supabase
      .from("match_results")
      .update({
        home_score: result.away_score,
        away_score: result.home_score,
        home_tries: result.away_tries,
        away_tries: result.home_tries,
        home_conversions: result.away_conversions,
        away_conversions: result.home_conversions,
        home_penalties: result.away_penalties,
        away_penalties: result.home_penalties,
        home_drop_goals: result.away_drop_goals,
        away_drop_goals: result.home_drop_goals,
      })
      .eq("fixture_id", fixture_id);
    if (scoreError) return { ok: false, error: scoreError.message };
  }

  // A generated slug encodes the old team order, so rebuild it. Best-effort:
  // the column only exists after integration_schema.sql has been run, and a
  // stale URL must not fail a correction that has already been applied.
  await rebuildFixtureSlug(supabase, fixture_id, fixture);

  revalidatePath(`/admin/results/${fixture_id}`);
  revalidatePath(`/admin/fixtures/${fixture_id}`);
  revalidatePath("/admin/results");
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/standings");

  return { ok: true };
}

/** Rewrites a generated slug into the new team order. Hand-edited slugs and a
 *  missing slug column are both left alone. */
async function rebuildFixtureSlug(
  supabase: ReturnType<typeof createAdminClient>,
  fixture_id: string,
  before: { home_team_id: string | null; away_team_id: string | null; scheduled_date: string | null }
) {
  if (!before.scheduled_date) return;

  const { data: current, error: readError } = await supabase
    .from("fixtures")
    .select("slug")
    .eq("fixture_id", fixture_id)
    .maybeSingle();
  if (readError || !current?.slug) return;

  const { data: teams } = await supabase
    .from("teams")
    .select("team_id, name")
    .in("team_id", [before.home_team_id, before.away_team_id].filter(Boolean) as string[]);

  const nameOf = (id: string | null) =>
    (teams ?? []).find((t: any) => t.team_id === id)?.name ?? "tbc";
  const kebab = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const [y, m, d] = String(before.scheduled_date).slice(0, 10).split("-");
  const datePart = `${d}-${m}-${y.slice(-2)}`;

  const generated = `${kebab(nameOf(before.home_team_id))}-${kebab(nameOf(before.away_team_id))}-${datePart}`;
  if (current.slug !== generated) return; // edited by hand — leave it

  const swapped = `${kebab(nameOf(before.away_team_id))}-${kebab(nameOf(before.home_team_id))}-${datePart}`;
  await supabase.from("fixtures").update({ slug: swapped }).eq("fixture_id", fixture_id);
}

export async function upsertResult(fixture_id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = resultPayload(fd, fixture_id);
  const { error } = await supabase
    .from("match_results")
    .upsert(p, { onConflict: "fixture_id" });
  if (error) throw new Error(error.message);
  await supabase
    .from("fixtures")
    .update({ status: "completed" })
    .eq("fixture_id", fixture_id);
  revalidatePath("/admin/results");
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/standings");
  revalidatePath("/admin/dashboard");
}

export async function deleteResult(result_id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("match_results")
    .delete()
    .eq("result_id", result_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/results");
  revalidatePath("/admin/standings");
}

// ─── Score recalculation from events ─────────────────────────────────────────

const SCORING_TYPES = ["try", "conversion", "penalty_goal", "drop_goal"];
const POINTS: Record<string, number> = {
  try: 4,
  conversion: 2,
  penalty_goal: 2,
  drop_goal: 1,
};

async function recalcScoreFromEvents(supabase: any, fixture_id: string) {
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("home_team_id, away_team_id")
    .eq("fixture_id", fixture_id)
    .maybeSingle();
  if (!fixture) return;

  const { data: events } = await supabase
    .from("match_events")
    .select("event_type, team_id")
    .eq("fixture_id", fixture_id)
    .in("event_type", SCORING_TYPES);

  const homeEvents = (events ?? []).filter((e: any) => e.team_id === fixture.home_team_id);
  const awayEvents = (events ?? []).filter((e: any) => e.team_id === fixture.away_team_id);

  function count(evs: any[], type: string) {
    return evs.filter((e: any) => e.event_type === type).length;
  }

  const homeTries = count(homeEvents, "try");
  const homeConv  = count(homeEvents, "conversion");
  const homePens  = count(homeEvents, "penalty_goal");
  const homeDrops = count(homeEvents, "drop_goal");
  const awayTries = count(awayEvents, "try");
  const awayConv  = count(awayEvents, "conversion");
  const awayPens  = count(awayEvents, "penalty_goal");
  const awayDrops = count(awayEvents, "drop_goal");

  const homeScore = homeTries * 4 + homeConv * 2 + homePens * 2 + homeDrops;
  const awayScore = awayTries * 4 + awayConv * 2 + awayPens * 2 + awayDrops;

  await supabase.from("match_results").upsert(
    {
      fixture_id,
      home_score: homeScore,
      away_score: awayScore,
      home_tries: homeTries,
      home_conversions: homeConv,
      home_penalties: homePens,
      home_drop_goals: homeDrops,
      away_tries: awayTries,
      away_conversions: awayConv,
      away_penalties: awayPens,
      away_drop_goals: awayDrops,
    },
    { onConflict: "fixture_id" }
  );

  await supabase
    .from("fixtures")
    .update({ status: "completed" })
    .eq("fixture_id", fixture_id);
}

// ─── Event actions ────────────────────────────────────────────────────────────

function detectHalf(minute: number, is9s: boolean): number {
  const halfLen = is9s ? 20 : 40;
  if (minute <= halfLen) return 1;
  if (minute <= halfLen * 2) return 2;
  return 3; // extra time
}

export async function addEvent(fixture_id: string, fd: FormData) {
  const supabase = createAdminClient();

  const team_id   = str(fd, "team_id");
  const player_id = str(fd, "player_id");
  const event_type = str(fd, "event_type");
  const minutesRaw = str(fd, "minutes"); // comma-separated e.g. "5, 23, 37"
  const is9s = fd.get("is9s") === "true";
  const notes = str(fd, "notes");

  if (!event_type) throw new Error("`event_type` is required");
  if (!team_id)    throw new Error("`team_id` is required");

  // Parse comma-separated minutes; empty string → [null] (one event, no minute)
  const parsed: (number | null)[] = minutesRaw
    ? minutesRaw
        .split(",")
        .map((s) => { const n = parseInt(s.trim(), 10); return isNaN(n) ? null : n; })
        .filter((n, i, arr) => n !== null || arr.length === 1) // drop blanks unless only entry
    : [null];

  const rows = parsed.map((minute) => ({
    fixture_id,
    team_id,
    player_id: player_id || null,
    event_type,
    minute: minute ?? null,
    half: minute !== null ? detectHalf(minute, is9s) : null,
    notes,
  }));

  const { error } = await supabase.from("match_events").insert(rows);
  if (error) throw new Error(error.message);

  if (SCORING_TYPES.includes(event_type)) {
    await recalcScoreFromEvents(supabase, fixture_id);
    revalidatePath("/admin/standings");
    revalidatePath("/admin/results");
  }

  revalidatePath(`/admin/results/${fixture_id}`);
}

// ─── Player rating actions ────────────────────────────────────────────────────

export async function saveRatings(
  fixture_id: string,
  ratings: { player_id: string; team_id: string; rating: number; notes: string | null }[]
) {
  if (ratings.length === 0) return;
  const supabase = createAdminClient();
  const rows = ratings.map((r) => ({ ...r, fixture_id }));
  const { error } = await supabase
    .from("match_player_ratings")
    .upsert(rows, { onConflict: "fixture_id,player_id" });
  if (error) throw new Error(error.message);

  // Recalculate each player's general rating as the average across all their match ratings
  const playerIds = Array.from(new Set(ratings.map((r) => r.player_id)));
  for (const player_id of playerIds) {
    const { data: allRatings } = await supabase
      .from("match_player_ratings")
      .select("rating")
      .eq("player_id", player_id);
    if (allRatings && allRatings.length > 0) {
      const avg = allRatings.reduce((sum, r: any) => sum + Number(r.rating), 0) / allRatings.length;
      const rounded = Math.round(avg * 10) / 10;
      await supabase.from("players").update({ rating: rounded }).eq("player_id", player_id);
    }
  }

  revalidatePath(`/admin/results/${fixture_id}`);
  revalidatePath("/admin/players");
}

export async function deleteRating(rating_id: string, fixture_id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("match_player_ratings")
    .delete()
    .eq("rating_id", rating_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/results/${fixture_id}`);
}

// ─── Event actions ────────────────────────────────────────────────────────────

export async function deleteEvent(event_id: string) {
  const supabase = createAdminClient();

  // Fetch first so we know fixture_id and whether it's a scoring event
  const { data: ev } = await supabase
    .from("match_events")
    .select("fixture_id, event_type")
    .eq("event_id", event_id)
    .maybeSingle();

  const { error } = await supabase
    .from("match_events")
    .delete()
    .eq("event_id", event_id);
  if (error) throw new Error(error.message);

  if (ev?.fixture_id) {
    if (SCORING_TYPES.includes(ev.event_type)) {
      await recalcScoreFromEvents(supabase, ev.fixture_id);
      revalidatePath("/admin/standings");
      revalidatePath("/admin/results");
    }
    revalidatePath(`/admin/results/${ev.fixture_id}`);
  } else {
    revalidatePath("/admin/results", "layout");
  }
}