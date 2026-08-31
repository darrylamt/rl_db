"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requirePlayer, getAppUser } from "@/lib/auth";
import { lengthProblem } from "@/lib/contracts";

type Outcome = { error: string } | { note: string };

function done(outcome: Outcome, page = "/player") {
  revalidatePath(page);
  revalidatePath("/club/contracts");
  redirect(`${page}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Answers a contract offer.
 *
 * Only the player can. A club writing terms down does not put anybody under
 * contract, which is the reason player accounts exist at all.
 */
export async function answerContract(
  contractId: string,
  accept: boolean,
  fd: FormData
) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();
  const why = ((fd.get("why") as string) ?? "").trim() || null;

  const { data: c } = await supabase
    .from("contracts")
    .select("contract_id, player_id, status, team:team_id(name)")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (!c || (c as any).player_id !== playerId) {
    done({ error: "That offer is not yours." });
  }
  if ((c as any).status !== "offered") {
    done({ error: "That one is not waiting on you." });
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      status: accept ? "accepted" : "declined",
      answered_at: new Date().toISOString(),
      decline_note: accept ? null : why,
    })
    .eq("contract_id", contractId);

  const club = (c as any).team?.name ?? "the club";
  done(
    error
      ? { error: error.message }
      : { note: accept ? `You are signed with ${club}.` : `You turned down ${club}.` }
  );
}

/**
 * Says whether you are available for a match.
 *
 * Three states, not two. Signed out means you cannot be named. Signed in
 * means you have put yourself forward. Saying nothing means neither, and you
 * can be named as normal — silence is not a refusal, and a player who never
 * opens this should not quietly drop out of their club's plans.
 */
export async function setAvailability(fixtureId: string, status: string) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  if (!["in", "out", "clear"].includes(status)) {
    done({ error: "Unknown answer." }, "/player/availability");
  }

  if (status === "clear") {
    const { error } = await supabase
      .from("player_availability")
      .delete()
      .eq("player_id", playerId)
      .eq("fixture_id", fixtureId);
    done(
      error ? { error: error.message } : { note: "Answer cleared — you can be named as normal." },
      "/player/availability"
    );
  }

  const { error } = await supabase.from("player_availability").upsert(
    {
      player_id: playerId,
      fixture_id: fixtureId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,fixture_id" }
  );

  done(
    error
      ? { error: error.message }
      : {
          note:
            status === "out"
              ? "Signed out — your club cannot name you for that match."
              : "Signed in — your club knows you are available.",
        },
    "/player/availability"
  );
}

/**
 * Changes the password.
 *
 * Every seeded account starts on the same one, so this is the first thing an
 * account is asked to do and the only thing it can reach until it has.
 */
export async function changePassword(fd: FormData) {
  const user = await getAppUser();
  if (!user) redirect("/admin/login");

  const password = (fd.get("password") as string) ?? "";
  const again = (fd.get("again") as string) ?? "";

  let outcome: Outcome;
  if (password.length < 8) {
    outcome = { error: "Pick something at least 8 characters long." };
  } else if (password !== again) {
    outcome = { error: "Those two do not match." };
  } else if (password === "RLFG@08") {
    outcome = { error: "That is the shared one everybody starts with. Pick your own." };
  } else {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      outcome = { error: error.message };
    } else {
      const admin = createAdminClient();
      await admin
        .from("app_users")
        .update({ must_change_password: false })
        .eq("user_id", user.userId);
      redirect("/player?note=Password+changed.+Welcome+in.");
    }
  }

  redirect(`/player/password?${new URLSearchParams(outcome as any)}`);
}

/**
 * Proposes different terms.
 *
 * A counter is not a refusal — the offer stays alive and goes back to the
 * club, who can take it or come back again. Refusing ends it; this keeps it
 * going, which is what somebody who wants to stay but not on those terms
 * actually needs.
 */
export async function counterContract(contractId: string, fd: FormData) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  const starts = ((fd.get("starts_on") as string) ?? "").trim();
  const ends = ((fd.get("ends_on") as string) ?? "").trim();
  const note = ((fd.get("note") as string) ?? "").trim() || null;

  const { data: c } = await supabase
    .from("contracts")
    .select("contract_id, player_id, status, team:team_id(name)")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (!c || (c as any).player_id !== playerId) {
    done({ error: "That offer is not yours." });
  }
  if ((c as any).status !== "offered") {
    done({ error: "That one is not waiting on you." });
  }

  const problem = lengthProblem(starts, ends);
  if (problem) done({ error: problem });

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "countered",
      starts_on: starts,
      ends_on: ends,
      // The player's reasoning belongs with the version they proposed, not
      // overwriting the terms the club wrote.
      decline_note: null,
    })
    .eq("contract_id", contractId);

  if (error) {
    done({
      error: /contracts_status_check/.test(error.message)
        ? "Countering needs supabase/contract_negotiation.sql to be run first."
        : error.message,
    });
  }

  await supabase.from("contract_proposals").insert({
    contract_id: contractId,
    proposed_by: "player",
    starts_on: starts,
    ends_on: ends,
    note,
  });

  const club = (c as any).team?.name ?? "the club";
  done({ note: `Sent back to ${club}. They can accept your terms or come back again.` });
}
