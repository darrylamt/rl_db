"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/transfer-requests";

function describe(message: string) {
  if (/transfer_requests/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/transfer_requests.sql first.";
  }
  return message;
}

/**
 * Signs a move off, and carries it out.
 *
 * This is the only place a registration changes hands. Two clubs agreeing is
 * an agreement; it becomes a transfer here.
 *
 * The player's current club is checked again first. Between the clubs
 * agreeing and this being signed off they may have moved some other way, and
 * approving a stale request would take them from a club they had already
 * left.
 */
export async function approveTransfer(requestId: string) {
  await requireFederation();
  const supabase = createAdminClient();
  const user = await getAppUser();

  let outcome: Outcome;
  try {
    const { data: req } = await supabase
      .from("transfer_requests")
      .select(
        "request_id, status, kind, loan_until, player_id, from_team_id, to_team_id, player:player_id(first_name, last_name, team_id), to_team:to_team_id(name)"
      )
      .eq("request_id", requestId)
      .maybeSingle();

    if (!req) throw new Error("That request no longer exists.");
    const r = req as any;
    if (r.status !== "with_federation") {
      throw new Error("Only a request both clubs have agreed can be signed off.");
    }

    const player = Array.isArray(r.player) ? r.player[0] : r.player;
    const who = `${player?.first_name ?? ""} ${player?.last_name ?? ""}`.trim() || "The player";

    if (player?.team_id !== r.from_team_id) {
      throw new Error(
        `${who} is no longer at the club that agreed this. The request is out of date — decline it and start again.`
      );
    }

    const season = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);

    // The move itself.
    const { error: moveError } = await supabase
      .from("players")
      .update({ team_id: r.to_team_id })
      .eq("player_id", r.player_id);
    if (moveError) throw new Error(moveError.message);

    // Close the spell they are leaving, where one is open. A loan leaves the
    // old spell alone: they are expected back.
    if (r.kind === "transfer" && r.from_team_id) {
      await supabase
        .from("player_history")
        .update({ left_date: today })
        .eq("player_id", r.player_id)
        .eq("team_id", r.from_team_id)
        .is("left_date", null);
    }

    // And record the new one, so club history and the transfers page show it
    // the same way as every other move.
    await supabase.from("player_history").insert({
      player_id: r.player_id,
      team_id: r.to_team_id,
      season: String(season),
      role: r.kind === "loan" ? "loan" : "transfer",
      joined_date: today,
      left_date: r.kind === "loan" ? r.loan_until : null,
      notes:
        r.kind === "loan"
          ? `On loan until ${r.loan_until}. Agreed between the clubs and signed off.`
          : "Transfer agreed between the clubs and signed off.",
    });

    const { error } = await supabase
      .from("transfer_requests")
      .update({
        status: "approved",
        reviewed_by: user?.userId ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("request_id", requestId);
    if (error) throw new Error(error.message);

    outcome = {
      note: `${who} is now at ${r.to_team?.name ?? "their new club"}.`,
    };
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(PAGE);
  revalidatePath("/admin/players");
  revalidatePath("/admin/transfers");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/** Refuses a move the clubs agreed. Nothing changes hands. */
export async function declineTransfer(requestId: string, fd: FormData) {
  await requireFederation();
  const supabase = createAdminClient();
  const user = await getAppUser();
  const note = ((fd.get("reason") as string) ?? "").trim() || null;

  const { error } = await supabase
    .from("transfer_requests")
    .update({
      status: "declined",
      reviewed_by: user?.userId ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("request_id", requestId)
    .eq("status", "with_federation");

  const outcome: Outcome = error
    ? { error: describe(error.message) }
    : { note: `Refused${note ? ` — ${note}` : ""}. Nobody has moved.` };

  revalidatePath(PAGE);
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}
