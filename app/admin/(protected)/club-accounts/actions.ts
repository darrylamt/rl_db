"use server";

import { redirect } from "next/navigation";
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
type Outcome = { error: string } | { created: string } | { note: string };

/**
 * Issues a login for a club.
 *
 * Reports what happened rather than throwing. A thrown error in a server
 * action is a full-page crash in production, which tells the admin nothing
 * and loses the form they had filled in.
 */
async function attemptCreate(fd: FormData): Promise<Outcome> {
  const email = (fd.get("email") as string)?.trim().toLowerCase();
  const password = (fd.get("password") as string) ?? "";
  const team_id = (fd.get("team_id") as string)?.trim();

  if (!email) return { error: "Email is required." };
  if (!team_id) return { error: "Pick the club this login belongs to." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createAdminClient();

  // One email, one account — say which one rather than surfacing Supabase's
  // own wording out of context.
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    const { data: role } = await supabase
      .from("app_users")
      .select("role")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (role) {
      return {
        error: `${email} is already a ${role.role} account. One email can hold one login — use a different address.`,
      };
    }

    // An account with no role reaches nothing and cannot be repaired
    // anywhere else in the admin, so make it the club login that was asked
    // for, with the password that was typed.
    const { error: pwError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
    });
    if (pwError) return { error: pwError.message };

    const { error: roleError } = await supabase
      .from("app_users")
      .insert({ user_id: existing.id, role: "club", team_id, email });
    if (roleError) return { error: roleError.message };

    return {
      note: `${email} already had a sign-in with no access. It now belongs to that club, with the password you set.`,
    };
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };
  const userId = created.user?.id;
  if (!userId) return { error: "The account was not created." };

  const { error } = await supabase.from("app_users").insert({
    user_id: userId,
    role: "club",
    team_id,
    email,
  });
  if (error) {
    // Leave nothing half-made.
    await supabase.auth.admin.deleteUser(userId);
    return { error: error.message };
  }

  return { created: email };
}

export async function createClubAccount(fd: FormData) {
  await requireFederation();
  const outcome = await attemptCreate(fd);
  revalidatePath("/admin/club-accounts");
  // redirect throws to unwind, so it stays outside anything that catches.
  redirect(`/admin/club-accounts?${new URLSearchParams(outcome as any)}`);
}

/** Points an existing club account at a different club. */
export async function moveClubAccount(userId: string, fd: FormData) {
  await requireFederation();
  const team_id = (fd.get("team_id") as string)?.trim();
  const supabase = createAdminClient();
  const { error } = team_id
    ? await supabase
        .from("app_users")
        .update({ team_id })
        .eq("user_id", userId)
        .eq("role", "club")
    : { error: { message: "Pick a club." } };
  revalidatePath("/admin/club-accounts");
  redirect(
    error
      ? `/admin/club-accounts?${new URLSearchParams({ error: error.message })}`
      : "/admin/club-accounts?note=Club+changed."
  );
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
  if (!row || row.role !== "club") {
    redirect("/admin/club-accounts?error=That+is+not+a+club+account.");
  }

  await supabase.from("app_users").delete().eq("user_id", userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  revalidatePath("/admin/club-accounts");
  redirect(
    error
      ? `/admin/club-accounts?${new URLSearchParams({ error: error.message })}`
      : "/admin/club-accounts?note=Login+revoked."
  );
}

/** Sets a new password, for when a club has lost theirs. */
export async function resetClubPassword(userId: string, fd: FormData) {
  await requireFederation();
  const password = (fd.get("password") as string) ?? "";

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("app_users")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();

  let outcome: Outcome;
  if (password.length < 8) {
    outcome = { error: "Password must be at least 8 characters." };
  } else if (!row || row.role !== "club") {
    outcome = { error: "That is not a club account." };
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    outcome = error
      ? { error: error.message }
      : { note: `New password set for ${row.email ?? "that club"}.` };
  }

  revalidatePath("/admin/club-accounts");
  redirect(`/admin/club-accounts?${new URLSearchParams(outcome as any)}`);
}
