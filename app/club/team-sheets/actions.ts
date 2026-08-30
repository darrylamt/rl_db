"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireClub, getAppUser } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

function describe(message: string) {
  if (/team_sheets/.test(message) && /does not exist|relation/i.test(message)) {
    return "Team sheets need supabase/team_sheets.sql to be run first.";
  }
  return message;
}

/**
 * Confirms this fixture is actually the club's before anything is written.
 *
 * The fixture id arrives from a URL, which makes it the caller's claim. A
 * club must not be able to name a side in someone else's match, nor name
 * the opposition in its own.
 */
async function ownedFixture(fixtureId: string) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const { data: fixture } = await supabase
    .from("fixtures")
    .select("fixture_id, home_team_id, away_team_id, scheduled_date, status")
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (!fixture) throw new Error("That fixture does not exist");
  if (fixture.home_team_id !== teamId && fixture.away_team_id !== teamId) {
    throw new Error("Your club is not playing in that fixture");
  }
  return { supabase, teamId, fixture };
}

/** The sheet for this club and fixture, created on first use. */
async function sheetFor(
  supabase: ReturnType<typeof createAdminClient>,
  fixtureId: string,
  teamId: string
) {
  const { data: existing } = await supabase
    .from("team_sheets")
    .select("sheet_id, status")
    .eq("fixture_id", fixtureId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("team_sheets")
    .insert({ fixture_id: fixtureId, team_id: teamId, status: "draft" })
    .select("sheet_id, status")
    .single();
  if (error) throw new Error(describe(error.message));
  return created;
}

/**
 * Saves the named side.
 *
 * The whole sheet is replaced rather than merged: the form posts the side as
 * it now stands, and a player removed from it has to actually leave. Only
 * ever while the sheet is the club's to change.
 */
export async function saveTeamSheet(fixtureId: string, fd: FormData) {
  const { supabase, teamId } = await ownedFixture(fixtureId);

  let outcome: Outcome;
  try {
    const sheet = await sheetFor(supabase, fixtureId, teamId);

    if (sheet.status === "submitted" || sheet.status === "approved") {
      outcome = {
        error:
          sheet.status === "approved"
            ? "This sheet is approved. Ask the federation to reopen it."
            : "This sheet is with the federation. Withdraw it to make changes.",
      };
    } else {
      // "picked:<player_id>" is on for each name in the side; the jersey and
      // starter fields are read only for those.
      const picked = Array.from(fd.keys())
        .filter((k) => k.startsWith("picked:"))
        .map((k) => k.slice("picked:".length));

      const rows = picked.map((playerId) => {
        const jersey = (fd.get(`jersey:${playerId}`) as string) ?? "";
        const n = parseInt(jersey, 10);
        return {
          fixture_id: fixtureId,
          team_id: teamId,
          player_id: playerId,
          jersey_number: Number.isNaN(n) ? null : n,
          position: ((fd.get(`position:${playerId}`) as string) ?? "").trim() || null,
          is_starter: fd.get(`bench:${playerId}`) !== "on",
        };
      });

      // Anyone dropped from the side goes, then the rest are written.
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

      // A declined sheet that has been edited is a draft again, not a
      // standing refusal.
      if (sheet.status === "declined") {
        await supabase
          .from("team_sheets")
          .update({ status: "draft", review_note: null })
          .eq("sheet_id", sheet.sheet_id);
      }

      outcome = {
        note: `Saved ${rows.length} player${rows.length === 1 ? "" : "s"}. Submit when the side is final.`,
      };
    }
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(`/club/team-sheets/${fixtureId}`);
  revalidatePath("/club/team-sheets");
  redirect(`/club/team-sheets/${fixtureId}?${new URLSearchParams(outcome as any)}`);
}

/** Sends the sheet to the federation. */
export async function submitTeamSheet(fixtureId: string) {
  const { supabase, teamId } = await ownedFixture(fixtureId);
  const user = await getAppUser();

  let outcome: Outcome;
  try {
    const sheet = await sheetFor(supabase, fixtureId, teamId);

    const { count } = await supabase
      .from("match_lineups")
      .select("lineup_id", { count: "exact", head: true })
      .eq("fixture_id", fixtureId)
      .eq("team_id", teamId);

    if (sheet.status === "approved") {
      outcome = { error: "This sheet is already approved." };
    } else if (!count) {
      outcome = { error: "Name at least one player before submitting." };
    } else {
      const { error } = await supabase
        .from("team_sheets")
        .update({
          status: "submitted",
          submitted_by: user?.userId ?? null,
          submitted_at: new Date().toISOString(),
          review_note: null,
        })
        .eq("sheet_id", sheet.sheet_id);
      if (error) throw new Error(error.message);
      outcome = {
        note: `${count} player${count === 1 ? "" : "s"} sent to the federation for approval.`,
      };
    }
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(`/club/team-sheets/${fixtureId}`);
  revalidatePath("/club/team-sheets");
  redirect(`/club/team-sheets/${fixtureId}?${new URLSearchParams(outcome as any)}`);
}

/** Takes it back to make changes, while the federation has not ruled on it. */
export async function withdrawTeamSheet(fixtureId: string) {
  const { supabase, teamId } = await ownedFixture(fixtureId);

  let outcome: Outcome;
  try {
    const sheet = await sheetFor(supabase, fixtureId, teamId);
    if (sheet.status !== "submitted") {
      outcome = { error: "Only a sheet waiting on the federation can be withdrawn." };
    } else {
      const { error } = await supabase
        .from("team_sheets")
        .update({ status: "draft", submitted_at: null })
        .eq("sheet_id", sheet.sheet_id);
      if (error) throw new Error(error.message);
      outcome = { note: "Withdrawn. It is yours to change again." };
    }
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(`/club/team-sheets/${fixtureId}`);
  redirect(`/club/team-sheets/${fixtureId}?${new URLSearchParams(outcome as any)}`);
}
