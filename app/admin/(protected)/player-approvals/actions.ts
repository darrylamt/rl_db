"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/player-approvals";

/** The one database error here worth explaining in words. */
function describe(message: string) {
  if (/approval_status|submitted_by|reviewed_by/.test(message) && /column/i.test(message)) {
    return "Approvals need supabase/player_approvals.sql to be run first.";
  }
  return message;
}

async function decide(
  playerId: string,
  status: "approved" | "declined",
  note: string | null
): Promise<Outcome> {
  const supabase = createAdminClient();
  const user = await getAppUser();

  const { data: player } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, approval_status, team:team_id(name)")
    .eq("player_id", playerId)
    .maybeSingle();

  if (!player) return { error: "That player no longer exists." };

  const name = `${(player as any).first_name ?? ""} ${(player as any).last_name ?? ""}`.trim();

  const { error } = await supabase
    .from("players")
    .update({
      approval_status: status,
      reviewed_by: user?.userId ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note,
      // An approved player joins the register properly; a declined one is
      // left off it rather than deleted, so the club can see the decision.
      ...(status === "approved" ? { playing_status: "active" } : {}),
    })
    .eq("player_id", playerId);

  if (error) return { error: describe(error.message) };

  return {
    note:
      status === "approved"
        ? `${name || "The player"} is on the register.`
        : `${name || "The player"} was declined${note ? ` — ${note}` : ""}.`,
  };
}

export async function approvePlayer(playerId: string) {
  await requireFederation();
  const outcome = await decide(playerId, "approved", null);
  revalidatePath(PAGE);
  revalidatePath("/admin/players");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

export async function declinePlayer(playerId: string, fd: FormData) {
  await requireFederation();
  const note = ((fd.get("reason") as string) ?? "").trim() || null;
  const outcome = await decide(playerId, "declined", note);
  revalidatePath(PAGE);
  revalidatePath("/admin/players");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/** Puts a declined submission back in the queue, for a club that has fixed it. */
export async function reopenPlayer(playerId: string) {
  await requireFederation();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("players")
    .update({ approval_status: "pending", review_note: null, reviewed_at: null })
    .eq("player_id", playerId);

  const outcome: Outcome = error
    ? { error: describe(error.message) }
    : { note: "Back in the queue for a decision." };

  revalidatePath(PAGE);
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}
