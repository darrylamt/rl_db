"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePlayer } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/player/transfers";

function describe(message: string) {
  if (/player_transfer_requests|with_player/.test(message) && /does not exist|violates check/i.test(message)) {
    return "This needs supabase/player_in_the_transfer.sql to be run first.";
  }
  if (/one_open_request_per_player/.test(message)) {
    return "You already have a request with your club. Asking twice is not asking harder.";
  }
  return message;
}

function done(outcome: Outcome) {
  revalidatePath(PAGE);
  revalidatePath("/club/transfers");
  revalidatePath("/admin/transfer-requests");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Answers a club's approach.
 *
 * The selling club has already agreed by the time this is reachable, so
 * accepting sends it to the federation and refusing ends it. Nobody else can
 * answer this on the player's behalf — that is the whole point of the step.
 */
export async function answerBid(requestId: string, accept: boolean, fd: FormData) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();
  const note = ((fd.get("note") as string) ?? "").trim() || null;

  const { data: bid } = await supabase
    .from("transfer_requests")
    .select("request_id, player_id, status, to_team:to_team_id(name)")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!bid || (bid as any).player_id !== playerId) {
    done({ error: "That approach is not about you." });
  }
  if ((bid as any).status !== "with_player") {
    done({ error: "That one is not waiting on you." });
  }

  const club = (bid as any).to_team?.name ?? "that club";

  const { error } = await supabase
    .from("transfer_requests")
    .update({
      status: accept ? "with_federation" : "player_declined",
      player_answered_at: new Date().toISOString(),
      player_note: note,
    })
    .eq("request_id", requestId);

  done(
    error
      ? { error: describe(error.message) }
      : {
          note: accept
            ? `You have agreed to join ${club}. The federation signs it off from here.`
            : `You have turned down ${club}.`,
        }
  );
}

/**
 * Asks your own club for a move.
 *
 * A request nobody wrote down is a request nobody can be held to, which is
 * why this exists at all rather than being left to a conversation.
 */
export async function requestMove(fd: FormData) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();
  const reason = ((fd.get("reason") as string) ?? "").trim() || null;

  const { data: me } = await supabase
    .from("players")
    .select("team_id")
    .eq("player_id", playerId)
    .maybeSingle();

  const teamId = (me as any)?.team_id;
  if (!teamId) {
    done({ error: "You are not at a club, so there is nobody to ask." });
  }

  const { error } = await supabase.from("player_transfer_requests").insert({
    player_id: playerId,
    team_id: teamId,
    reason,
  });

  done(
    error
      ? { error: describe(error.message) }
      : { note: "Your club has your request. They will answer it." }
  );
}

/** Thinks better of it. */
export async function withdrawMoveRequest(requestId: string) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  const { data: r } = await supabase
    .from("player_transfer_requests")
    .select("request_id, player_id, status")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!r || (r as any).player_id !== playerId) {
    done({ error: "That is not your request." });
  }
  if ((r as any).status !== "pending") {
    done({ error: "Your club has already answered that one." });
  }

  const { error } = await supabase
    .from("player_transfer_requests")
    .update({ status: "withdrawn", answered_at: new Date().toISOString() })
    .eq("request_id", requestId);

  done(error ? { error: describe(error.message) } : { note: "Request withdrawn." });
}
