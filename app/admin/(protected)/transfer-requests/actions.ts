"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
import { getPlayerValue } from "@/lib/playerValue";
import { formatLX, priceFor } from "@/lib/lx";
import { seasonForWriting } from "@/lib/seasons";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/transfer-requests";

function describe(message: string) {
  if (/transfer_requests/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/transfer_requests.sql first.";
  }
  return message;
}

/**
 * Moves the LX, and writes it down.
 *
 * Four rows at most, and they sum to nothing: the buyer pays the fee, the
 * seller receives exactly it, and the levy comes off the buyer on top and
 * lands in the federation's account. Money only enters the system through an
 * allocation and only leaves it through the levy or an expiry, which is what
 * makes the totals on /admin/finance checkable by adding up a column.
 *
 * A free agent costs nothing. Nobody is losing a player, so there is nobody
 * to compensate — and picking up an unattached player should always be
 * cheaper than raiding a squad.
 *
 * Failing here does not undo the move. The registration is the thing that
 * matters and it has already happened; a missing ledger row is a correction
 * the federation can make by hand, and losing the transfer over it would not
 * be.
 */
async function settleTheMoney(r: any, who: string): Promise<string> {
  const supabase = createAdminClient();

  // Nobody to pay.
  if (!r.from_team_id) return "";

  let fee: number | null = typeof r.fee === "number" ? r.fee : null;
  let levy: number | null = typeof r.levy === "number" ? r.levy : null;
  let pricedNow = false;

  // A request made before the price was ever quoted — either the migration
  // had not been run or it predates all of this. Priced at sign-off rather
  // than waved through for nothing.
  if (fee === null) {
    const valuation = await getPlayerValue(r.player_id);
    if (!valuation) return "";
    const quote = priceFor(valuation.value, r.kind === "loan" ? "loan" : "transfer");
    fee = quote.fee;
    levy = quote.levy;
    pricedNow = true;
  }
  if (levy === null) levy = 0;
  if (fee <= 0 && levy <= 0) return "";

  const season = await seasonForWriting();
  const what = r.kind === "loan" ? "Loan" : "Transfer";
  const note = `${what} of ${who}${pricedNow ? " — priced at sign-off" : ""}.`;

  const rows = [
    {
      team_id: r.to_team_id,
      kind: "fee",
      amount: -fee,
      season,
      player_id: r.player_id,
      counterparty_team_id: r.from_team_id,
      request_id: r.request_id,
      note,
    },
    {
      team_id: r.from_team_id,
      kind: "fee",
      amount: fee,
      season,
      player_id: r.player_id,
      counterparty_team_id: r.to_team_id,
      request_id: r.request_id,
      note,
    },
  ];

  if (levy > 0) {
    rows.push(
      {
        team_id: r.to_team_id,
        kind: "levy",
        amount: -levy,
        season,
        player_id: r.player_id,
        counterparty_team_id: null,
        request_id: r.request_id,
        note: `Levy on the ${what.toLowerCase()} of ${who}.`,
      },
      {
        // The federation's own account.
        team_id: null,
        kind: "levy",
        amount: levy,
        season,
        player_id: r.player_id,
        counterparty_team_id: r.to_team_id,
        request_id: r.request_id,
        note: `Levy on the ${what.toLowerCase()} of ${who}.`,
      }
    );
  }

  const { error } = await supabase.from("lx_ledger").insert(rows);
  if (error) {
    // 42P01: supabase/club_budgets.sql has not been run. The move stands and
    // nothing is said about money, because there is no money yet.
    if ((error as any).code === "42P01") return "";
    return " The move went through, but the LX did not — record it by hand on the finance page.";
  }

  return ` ${formatLX(fee)} to their old club, ${formatLX(levy)} to the federation.`;
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
    const { data: req } = await readWithOptionalColumns<any>(
      "request_id, status, kind, loan_until, fee, levy, player_id, from_team_id, to_team_id, player:player_id(first_name, last_name, team_id), to_team:to_team_id(name)",
      ["fee", "levy"],
      (columns) =>
        supabase
          .from("transfer_requests")
          .select(columns)
          .eq("request_id", requestId)
          .maybeSingle()
    );

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

    // ── And the money ──
    // This is the only place LX changes hands. The fee was quoted when the
    // request was made and is honoured here rather than recalculated: values
    // move as records are corrected, and a price that changed between the
    // handshake and the signature would be unworkable.
    const paid = await settleTheMoney(r, who);

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
      note: `${who} is now at ${r.to_team?.name ?? "their new club"}.${paid}`,
    };
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(PAGE);
  revalidatePath("/admin/players");
  revalidatePath("/admin/transfers");
  // Both clubs' balances have just moved, and so has the federation's.
  revalidatePath("/admin/finance");
  revalidatePath("/club");
  revalidatePath("/club/transfers");
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
