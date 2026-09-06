"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";
import {
  carryOverCap,
  currentSeason,
  formatLX,
  getClubBudgets,
} from "@/lib/lx";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/finance";

function describe(message: string) {
  if (/lx_ledger/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/club_budgets.sql first.";
  }
  if (/one_allocation_per_club_per_season/.test(message)) {
    return "That club has already had its budget for this season.";
  }
  return message;
}

function back(outcome: Outcome) {
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Grants the season's budgets.
 *
 * Two things happen per club, in this order. Anything carried over above the
 * cap expires, and then the new allocation lands on top — so a club that
 * saved everything starts the season on the cap plus its grant, not on four
 * seasons of hoarding.
 *
 * A club that is overdrawn has nothing to expire, and its grant pays the
 * overdraft down first. That is the point of an overdraft rather than a
 * refusal: the debt follows you into the new season.
 *
 * Clubs already granted this season are skipped rather than failed, so the
 * button is safe to press twice and safe to press again after a new club
 * joins.
 */
export async function grantSeasonBudgets() {
  await requireFederation();
  const supabase = createAdminClient();
  const user = await getAppUser();
  const season = currentSeason();

  let outcome: Outcome;
  try {
    const { budgets, books } = await getClubBudgets(season);
    if (books.notMigrated) throw new Error("Run supabase/club_budgets.sql first.");

    const due = budgets.filter((b) => !b.granted);
    if (due.length === 0) {
      throw new Error(`Every club already has its ${season} budget.`);
    }

    const rows: any[] = [];
    let expired = 0;
    let granted = 0;

    for (const club of due) {
      const cap = carryOverCap(club.allocation);
      if (club.balance > cap) {
        const over = club.balance - cap;
        expired += over;
        rows.push({
          team_id: club.teamId,
          kind: "expiry",
          amount: -over,
          season,
          note: `Carried over above the ${formatLX(cap)} cap for ${season}.`,
          created_by: user?.userId ?? null,
        });
      }
      granted += club.allocation;
      rows.push({
        team_id: club.teamId,
        kind: "allocation",
        amount: club.allocation,
        season,
        note: `${season} budget — ${club.grades} grade${club.grades === 1 ? "" : "s"} fielded, ${club.seasons} season${club.seasons === 1 ? "" : "s"} on record.`,
        created_by: user?.userId ?? null,
      });
    }

    const { error } = await supabase.from("lx_ledger").insert(rows);
    if (error) throw new Error(error.message);

    outcome = {
      note:
        `Granted ${formatLX(granted)} across ${due.length} club${due.length === 1 ? "" : "s"} for ${season}.` +
        (expired > 0 ? ` ${formatLX(expired)} expired above the carry-over cap.` : ""),
    };
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(PAGE);
  revalidatePath("/club");
  back(outcome);
}

/**
 * A correction, made by hand.
 *
 * Every economy needs one of these — a fine, a grant outside the season's
 * allocation, a mistake being put right. It insists on a reason, because an
 * unexplained movement of money is worse than no record of it.
 */
export async function adjustBalance(fd: FormData) {
  await requireFederation();
  const supabase = createAdminClient();
  const user = await getAppUser();

  const teamId = ((fd.get("team_id") as string) ?? "").trim();
  const raw = ((fd.get("amount") as string) ?? "").trim();
  const note = ((fd.get("note") as string) ?? "").trim();

  let outcome: Outcome;
  try {
    if (!teamId) throw new Error("Pick a club.");
    const amount = Math.round(Number(raw));
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error("Give an amount — negative to take it away.");
    }
    if (!note) throw new Error("Say what the adjustment is for.");

    const { error } = await supabase.from("lx_ledger").insert({
      team_id: teamId,
      kind: "adjustment",
      amount,
      season: currentSeason(),
      note,
      created_by: user?.userId ?? null,
    });
    if (error) throw new Error(error.message);

    outcome = { note: `Adjusted by ${amount > 0 ? "+" : "−"}${Math.abs(amount)} LX.` };
  } catch (e: any) {
    outcome = { error: describe(e.message ?? String(e)) };
  }

  revalidatePath(PAGE);
  revalidatePath("/club");
  back(outcome);
}
