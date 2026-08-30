"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/team-sheets";

function describe(message: string) {
  if (/team_sheets/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/team_sheets.sql first.";
  }
  return message;
}

async function decide(
  sheetId: string,
  status: "approved" | "declined",
  note: string | null
): Promise<Outcome> {
  const supabase = createAdminClient();
  const user = await getAppUser();

  const { data: sheet } = await supabase
    .from("team_sheets")
    .select("sheet_id, status, team:team_id(name), fixture:fixture_id(scheduled_date)")
    .eq("sheet_id", sheetId)
    .maybeSingle();

  if (!sheet) return { error: "That team sheet no longer exists." };

  const club = (sheet as any).team?.name ?? "the club";

  const { error } = await supabase
    .from("team_sheets")
    .update({
      status,
      reviewed_by: user?.userId ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("sheet_id", sheetId);

  if (error) return { error: describe(error.message) };

  return {
    note:
      status === "approved"
        ? `${club}'s side is approved — the recorder will work from it.`
        : `${club}'s side was sent back${note ? ` — ${note}` : ""}.`,
  };
}

export async function approveSheet(sheetId: string) {
  await requireFederation();
  const outcome = await decide(sheetId, "approved", null);
  revalidatePath(PAGE);
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

export async function declineSheet(sheetId: string, fd: FormData) {
  await requireFederation();
  const note = ((fd.get("reason") as string) ?? "").trim() || null;
  const outcome = await decide(sheetId, "declined", note);
  revalidatePath(PAGE);
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Hands an approved sheet back to the club.
 *
 * A side changes after approval — an injury in the warm-up — and without
 * this the only way to fix it was for the federation to edit the line-up
 * itself, which is the job this feature exists to stop doing.
 */
export async function reopenSheet(sheetId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("team_sheets")
    .update({ status: "draft", review_note: null, reviewed_at: null })
    .eq("sheet_id", sheetId);

  const outcome: Outcome = error
    ? { error: describe(error.message) }
    : { note: "Reopened — the club can change it and submit again." };

  revalidatePath(PAGE);
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}
