"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Issues a login for a club.
 *
 * Creates the auth account with the service key and records what it is in
 * app_users in the same breath. If the second step fails the first is undone —
 * an account that can sign in but has no role would land on the no-access
 * page with no way forward.
 */
export async function createClubAccount(fd: FormData) {
  await requireFederation();

  const email = (fd.get("email") as string)?.trim().toLowerCase();
  const password = (fd.get("password") as string) ?? "";
  const team_id = (fd.get("team_id") as string)?.trim();

  if (!email || !team_id) throw new Error("Email and club are required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const supabase = createAdminClient();

  const { data: created, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError) throw new Error(authError.message);
  const userId = created.user?.id;
  if (!userId) throw new Error("Account was not created");

  const { error } = await supabase.from("app_users").insert({
    user_id: userId,
    role: "club",
    team_id,
    email,
  });
  if (error) {
    // Leave nothing half-made.
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(error.message);
  }

  revalidatePath("/admin/club-accounts");
}

/** Points an existing club account at a different club. */
export async function moveClubAccount(userId: string, fd: FormData) {
  await requireFederation();
  const team_id = (fd.get("team_id") as string)?.trim();
  if (!team_id) throw new Error("Pick a club");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_users")
    .update({ team_id })
    .eq("user_id", userId)
    .eq("role", "club");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/club-accounts");
}

/**
 * Removes a club login entirely — the role and the account behind it.
 *
 * Deleting only the role would leave an account that can still sign in and
 * would sit on the no-access page, which is worse than not existing.
 */
export async function revokeClubAccount(userId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  // Never let this be turned on a federation account.
  if (!row || row.role !== "club") throw new Error("That is not a club account");

  await supabase.from("app_users").delete().eq("user_id", userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/club-accounts");
}

/** Sets a new password, for when a club has lost theirs. */
export async function resetClubPassword(userId: string, fd: FormData) {
  await requireFederation();
  const password = (fd.get("password") as string) ?? "";
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || row.role !== "club") throw new Error("That is not a club account");

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/club-accounts");
}
