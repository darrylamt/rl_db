"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Issues a match-day login.
 *
 * The same two-step as a club account: create the auth user, record what it
 * is, and undo the first if the second fails. An account that can sign in but
 * has no role reaches nothing and cannot be told why.
 */
export async function createRecorderAccount(fd: FormData) {
  await requireFederation();

  const email = (fd.get("email") as string)?.trim().toLowerCase();
  const password = (fd.get("password") as string) ?? "";

  if (!email) throw new Error("Email is required");
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
    role: "recorder",
    email,
  });
  if (error) {
    await supabase.auth.admin.deleteUser(userId);
    // The check constraint only learned about recorders in
    // supabase/recorder_accounts.sql — say so rather than showing the raw
    // constraint name.
    if (/app_users_role_check/.test(error.message)) {
      throw new Error(
        "The database does not know the recorder role yet — run supabase/recorder_accounts.sql first."
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/recorders");
}

/** Removes a recorder login entirely — the role and the account behind it. */
export async function revokeRecorderAccount(userId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  // Never let this be turned on a federation or club account.
  if (!row || row.role !== "recorder") throw new Error("That is not a recorder account");

  await supabase.from("app_users").delete().eq("user_id", userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recorders");
}

/** Sets a new password, for when a recorder has lost theirs. */
export async function resetRecorderPassword(userId: string, fd: FormData) {
  await requireFederation();
  const password = (fd.get("password") as string) ?? "";
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || row.role !== "recorder") throw new Error("That is not a recorder account");

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recorders");
}
