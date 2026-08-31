"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireClub, getAppUser } from "@/lib/auth";
import { lengthProblem, renewalProblem } from "@/lib/contracts";

type Outcome = { error: string } | { note: string };

const PAGE = "/club/contracts";

function describe(message: string) {
  if (/contracts/.test(message) && /does not exist|relation/i.test(message)) {
    return "Contracts need supabase/contracts_and_players.sql to be run first.";
  }
  if (/one_open_offer_per_club_per_player/.test(message)) {
    return "You already have an offer on the table with that player.";
  }
  if (/one_accepted_contract_per_club_per_player|one_live_contract_per_club_per_player/.test(message)) {
    return "You already have a contract running with that player.";
  }
  if (/contract_runs_at_least_six_months/.test(message)) {
    return "The shortest contract is six months.";
  }
  if (/contract_runs_at_most_two_years/.test(message)) {
    return "The longest contract is two years.";
  }
  return message;
}

function done(outcome: Outcome) {
  revalidatePath(PAGE);
  revalidatePath("/player");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Offers a contract to a player.
 *
 * The offer is only that. A club cannot put a player under contract by
 * writing one down — the player has to accept it, which is the whole reason
 * players have accounts.
 */
export async function offerContract(fd: FormData) {
  const { teamId } = await requireClub();
  const user = await getAppUser();
  const supabase = createAdminClient();

  const playerId = ((fd.get("player_id") as string) ?? "").trim();
  const starts = ((fd.get("starts_on") as string) ?? "").trim();
  const ends = ((fd.get("ends_on") as string) ?? "").trim();
  const terms = ((fd.get("terms") as string) ?? "").trim() || null;

  if (!playerId) done({ error: "Pick a player." });

  // Checked here as well as in the database, so the club is told which rule
  // it broke rather than shown a constraint name.
  const problem = lengthProblem(starts, ends);
  if (problem) done({ error: problem });

  const { data: player } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, team_id")
    .eq("player_id", playerId)
    .maybeSingle();

  if (!player) done({ error: "That player no longer exists." });

  // The form only lists this club's squad, but a posted id is the caller's
  // claim rather than a fact — without this a club could offer terms to
  // somebody else's player and go round the transfer market entirely.
  if ((player as any).team_id !== teamId) {
    done({ error: "That player is not at your club. Sign them through transfers." });
  }

  // Re-signing your own player is allowed in the last month of their
  // contract, and the new terms have to start after the old ones end.
  const { data: current } = await supabase
    .from("contracts")
    .select("ends_on, status")
    .eq("player_id", playerId)
    .eq("team_id", teamId)
    .eq("status", "accepted")
    .maybeSingle();

  const renewal = renewalProblem(current as any, starts);
  if (renewal) done({ error: renewal });

  const { error } = await supabase.from("contracts").insert({
    player_id: playerId,
    team_id: teamId,
    starts_on: starts,
    ends_on: ends,
    terms,
    offered_by: user?.userId ?? null,
  });

  const name = `${(player as any).first_name ?? ""} ${(player as any).last_name ?? ""}`.trim();
  done(
    error
      ? { error: describe(error.message) }
      : { note: `Offered to ${name}. It is theirs to accept or turn down.` }
  );
}

/** Takes back an offer the player has not answered. */
export async function withdrawOffer(contractId: string) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const { data: c } = await supabase
    .from("contracts")
    .select("contract_id, team_id, status")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (!c || (c as any).team_id !== teamId) done({ error: "That is not your offer." });
  if ((c as any).status !== "offered") {
    done({ error: "That offer has already been answered." });
  }

  const { error } = await supabase
    .from("contracts")
    .update({ status: "withdrawn", ended_at: new Date().toISOString() })
    .eq("contract_id", contractId);

  done(error ? { error: describe(error.message) } : { note: "Offer withdrawn." });
}

/**
 * Ends a running contract early.
 *
 * Recorded rather than deleted: a contract that was agreed and then ended is
 * part of a player's history, and the club that signed them is entitled to
 * have that on record.
 */
export async function terminateContract(contractId: string, fd: FormData) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();
  const why = ((fd.get("why") as string) ?? "").trim() || null;

  const { data: c } = await supabase
    .from("contracts")
    .select("contract_id, team_id, status")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (!c || (c as any).team_id !== teamId) done({ error: "That is not your contract." });
  if ((c as any).status !== "accepted") {
    done({ error: "Only a contract the player has accepted can be ended." });
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "terminated",
      ended_at: new Date().toISOString(),
      ended_note: why,
    })
    .eq("contract_id", contractId);

  done(
    error ? { error: describe(error.message) } : { note: "Contract ended and recorded." }
  );
}
