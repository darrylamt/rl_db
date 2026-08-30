"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireClub, getAppUser } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/club/transfers";

function describe(message: string) {
  if (/transfer_requests/.test(message) && /does not exist|relation/i.test(message)) {
    return "Transfers need supabase/transfer_requests.sql to be run first.";
  }
  if (/one_open_request_per_club_per_player/.test(message)) {
    return "You already have an open request for that player.";
  }
  if (/a_loan_needs_an_end_date/.test(message)) {
    return "A loan needs a date to run until.";
  }
  return message;
}

function back(outcome: Outcome, tab?: string) {
  const params = new URLSearchParams(outcome as any);
  if (tab) params.set("tab", tab);
  redirect(`${PAGE}?${params}`);
}

/**
 * Asks another club for one of their players.
 *
 * The player's current club is read here rather than taken from the form:
 * a posted team id is the caller's claim, and it decides who gets to answer
 * the request.
 */
export async function requestPlayer(fd: FormData) {
  const { teamId } = await requireClub();
  const user = await getAppUser();
  const supabase = createAdminClient();

  const playerId = ((fd.get("player_id") as string) ?? "").trim();
  const kind = ((fd.get("kind") as string) ?? "transfer").trim();
  const loanUntil = ((fd.get("loan_until") as string) ?? "").trim() || null;
  const message = ((fd.get("message") as string) ?? "").trim() || null;

  let outcome: Outcome;
  try {
    if (!playerId) throw new Error("Pick a player.");
    if (kind !== "transfer" && kind !== "loan") throw new Error("Unknown request.");
    if (kind === "loan" && !loanUntil) throw new Error("A loan needs a date to run until.");

    const { data: player } = await supabase
      .from("players")
      .select("player_id, first_name, last_name, team_id, team:team_id(name)")
      .eq("player_id", playerId)
      .maybeSingle();

    if (!player) throw new Error("That player no longer exists.");
    if ((player as any).team_id === teamId) {
      throw new Error("That player is already yours.");
    }

    // Nobody holds a free agent, so there is no club to agree to it. The
    // request goes straight to the federation, which is the step that would
    // have followed anyway.
    const fromTeam = (player as any).team_id ?? null;
    const free = !fromTeam;

    const { error } = await supabase.from("transfer_requests").insert({
      player_id: playerId,
      from_team_id: fromTeam,
      to_team_id: teamId,
      kind,
      loan_until: kind === "loan" ? loanUntil : null,
      message,
      requested_by: user?.userId ?? null,
      status: free ? "with_federation" : "with_club",
      club_answered_at: free ? new Date().toISOString() : null,
      club_note: free ? "No club to answer — the player is a free agent." : null,
    });
    if (error) throw new Error(describe(error.message));

    const name = `${(player as any).first_name ?? ""} ${(player as any).last_name ?? ""}`.trim();
    outcome = {
      note: free
        ? `${name} has no club, so this goes straight to the federation to sign off.`
        : `Asked ${(player as any).team?.name ?? "their club"} about ${name}. They answer next.`,
    };
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(PAGE);
  back(outcome, "sent");
}

/** Takes back a request the other club has not answered. */
export async function withdrawRequest(requestId: string) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("transfer_requests")
    .select("request_id, to_team_id, status")
    .eq("request_id", requestId)
    .maybeSingle();

  let outcome: Outcome;
  if (!req || (req as any).to_team_id !== teamId) {
    outcome = { error: "That is not your request." };
  } else if ((req as any).status !== "with_club") {
    outcome = { error: "It has already been answered." };
  } else {
    const { error } = await supabase
      .from("transfer_requests")
      .update({ status: "withdrawn" })
      .eq("request_id", requestId);
    outcome = error ? { error: describe(error.message) } : { note: "Request withdrawn." };
  }

  revalidatePath(PAGE);
  back(outcome, "sent");
}

/**
 * The club holding the player answers.
 *
 * Accepting does not move anybody. It sends the request on to the federation,
 * which is the only place a registration actually changes.
 */
export async function answerRequest(
  requestId: string,
  accept: boolean,
  fd: FormData
) {
  const { teamId } = await requireClub();
  const user = await getAppUser();
  const supabase = createAdminClient();
  const note = ((fd.get("note") as string) ?? "").trim() || null;

  const { data: req } = await supabase
    .from("transfer_requests")
    .select("request_id, from_team_id, status, player:player_id(first_name, last_name)")
    .eq("request_id", requestId)
    .maybeSingle();

  let outcome: Outcome;
  if (!req || (req as any).from_team_id !== teamId) {
    outcome = { error: "That request is not about one of your players." };
  } else if ((req as any).status !== "with_club") {
    outcome = { error: "That request has already been answered." };
  } else {
    const p = (req as any).player;
    const player = Array.isArray(p) ? p[0] : p;
    const name = `${player?.first_name ?? ""} ${player?.last_name ?? ""}`.trim() || "the player";

    const { error } = await supabase
      .from("transfer_requests")
      .update({
        status: accept ? "with_federation" : "rejected",
        club_answered_by: user?.userId ?? null,
        club_answered_at: new Date().toISOString(),
        club_note: note,
      })
      .eq("request_id", requestId);

    outcome = error
      ? { error: describe(error.message) }
      : {
          note: accept
            ? `Agreed. ${name} does not move until the federation signs it off.`
            : `Turned down the approach for ${name}.`,
        };
  }

  revalidatePath(PAGE);
  back(outcome, "received");
}
