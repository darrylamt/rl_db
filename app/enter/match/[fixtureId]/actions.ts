"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";

/**
 * What a recorder can set about a match that is not a score.
 *
 * The club portal names a side before a game and the admin appoints
 * officials, but neither reaches a match played three seasons ago that
 * nobody wrote down. A recorder filling in history needs all of it in one
 * place, so this is that place.
 *
 * Every action re-checks the caller. /enter's layout turns the wrong account
 * away, but a layout is a convenience and a server action is the thing that
 * actually holds.
 */
async function requireRecorder() {
  const user = await getAppUser();
  if (!user || user.onHold || !user.provisioned) {
    throw new Error("Not signed in.");
  }
  if (user.role !== "recorder" && user.role !== "federation") {
    throw new Error("Only a recorder or the federation can do that.");
  }
  return user;
}

function back(fixtureId: string, outcome: { error: string } | { note: string }) {
  redirect(
    `/enter/match/${fixtureId}?${new URLSearchParams(outcome as any)}`
  );
}

function done(fixtureId: string) {
  revalidatePath(`/enter/match/${fixtureId}`);
  revalidatePath(`/live/${fixtureId}`);
  revalidatePath("/enter/archive");
}

/** Referee and the two touch judges. Blank takes somebody off. */
export async function saveOfficials(fixtureId: string, fd: FormData) {
  let outcome: { error: string } | { note: string };
  try {
    await requireRecorder();
    const supabase = createAdminClient();
    const roles = ["referee", "touch_judge_1", "touch_judge_2"] as const;

    const rows = roles
      .map((role) => ({ role, official_id: ((fd.get(role) as string) ?? "").trim() }))
      .filter((r) => r.official_id)
      .map((r) => ({ fixture_id: fixtureId, role: r.role, official_id: r.official_id }));

    await supabase.from("fixture_officials").delete().eq("fixture_id", fixtureId);
    if (rows.length > 0) {
      const { error } = await supabase.from("fixture_officials").insert(rows);
      if (error) throw new Error(error.message);
    }
    outcome = {
      note: rows.length
        ? `Saved ${rows.length} official${rows.length === 1 ? "" : "s"}.`
        : "Took every official off this match.",
    };
  } catch (e: any) {
    outcome = { error: e.message ?? String(e) };
  }
  done(fixtureId);
  back(fixtureId, outcome);
}

/**
 * Who was in charge of each side.
 *
 * A side with no team sheet gets one as a draft rather than approved:
 * recording who coached a game is not signing off a line-up.
 */
export async function saveCoaches(fixtureId: string, fd: FormData) {
  let outcome: { error: string } | { note: string };
  try {
    await requireRecorder();
    const supabase = createAdminClient();

    const { data: fixture } = await supabase
      .from("fixtures")
      .select("home_team_id, away_team_id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();
    if (!fixture) throw new Error("That fixture no longer exists.");

    const sides = [
      { key: "home", teamId: (fixture as any).home_team_id },
      { key: "away", teamId: (fixture as any).away_team_id },
    ];

    for (const side of sides) {
      if (!side.teamId) continue;
      const head = ((fd.get(`${side.key}_head_coach_id`) as string) ?? "").trim() || null;
      const assistant =
        ((fd.get(`${side.key}_assistant_coach_id`) as string) ?? "").trim() || null;

      const { data: sheet } = await supabase
        .from("team_sheets")
        .select("sheet_id")
        .eq("fixture_id", fixtureId)
        .eq("team_id", side.teamId)
        .maybeSingle();

      const values = { head_coach_id: head, assistant_coach_id: assistant };
      if (sheet) {
        await supabase
          .from("team_sheets")
          .update(values)
          .eq("sheet_id", (sheet as any).sheet_id);
      } else if (head || assistant) {
        await supabase.from("team_sheets").insert({
          fixture_id: fixtureId,
          team_id: side.teamId,
          status: "draft",
          ...values,
        });
      }
    }
    outcome = { note: "Coaches saved." };
  } catch (e: any) {
    outcome = { error: e.message ?? String(e) };
  }
  done(fixtureId);
  back(fixtureId, outcome);
}

/**
 * The side one club put out.
 *
 * Replaced rather than merged: the form posts the eleven or seventeen names
 * as they now stand, and a player taken off has to actually leave. Saved one
 * club at a time so a recorder can do the home side, check it, then the away.
 */
export async function saveLineup(
  fixtureId: string,
  teamId: string,
  fd: FormData
) {
  let outcome: { error: string } | { note: string };
  try {
    await requireRecorder();
    const supabase = createAdminClient();

    const picked = Array.from(fd.keys())
      .filter((k) => k.startsWith("picked:"))
      .map((k) => k.slice("picked:".length));

    const rows = picked.map((playerId) => {
      const jersey = parseInt(((fd.get(`jersey:${playerId}`) as string) ?? ""), 10);
      return {
        fixture_id: fixtureId,
        team_id: teamId,
        player_id: playerId,
        jersey_number: Number.isNaN(jersey) ? null : jersey,
        is_starter: fd.get(`bench:${playerId}`) !== "on",
      };
    });

    await supabase
      .from("match_lineups")
      .delete()
      .eq("fixture_id", fixtureId)
      .eq("team_id", teamId);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("match_lineups")
        .upsert(rows, { onConflict: "fixture_id,team_id,player_id" });
      if (error) throw new Error(error.message);
    }

    outcome = {
      note: `Named ${rows.length} player${rows.length === 1 ? "" : "s"}.`,
    };
  } catch (e: any) {
    outcome = { error: e.message ?? String(e) };
  }
  done(fixtureId);
  back(fixtureId, outcome);
}
