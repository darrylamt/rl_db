"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { record } from "@/lib/audit";
import { revalidatePath } from "next/cache";

type Outcome = { error: string } | { created: string } | { note: string };

/** Finds an auth account by email, or null. */
async function findAuthUser(supabase: ReturnType<typeof createAdminClient>, email: string) {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).find((u) => u.email?.toLowerCase() === email) ?? null;
}

/**
 * Issues a match-day login.
 *
 * Returns what happened rather than throwing. A thrown error in a server
 * action is a full-page crash in production — the admin loses the form and
 * is told only that "a server-side exception has occurred", which is no help
 * at all when the real answer is "that email is already taken".
 */
async function attemptCreate(fd: FormData): Promise<Outcome> {
  const email = (fd.get("email") as string)?.trim().toLowerCase();
  const password = (fd.get("password") as string) ?? "";

  if (!email) return { error: "Email is required." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createAdminClient();

  // An email can only ever hold one account, so say what the existing one is
  // rather than letting Supabase's own wording surface.
  const existing = await findAuthUser(supabase, email);
  if (existing) {
    const { data: role } = await supabase
      .from("app_users")
      .select("role")
      .eq("user_id", existing.id)
      .maybeSingle();

    if (role?.role === "recorder") {
      return { error: `${email} is already a recorder.` };
    }
    if (role) {
      return {
        error: `${email} is already a ${role.role} account. One email can hold one login — use a different address.`,
      };
    }

    // An account with no role reaches nothing and cannot be repaired from
    // anywhere else in the admin, so adopt it as the recorder that was asked
    // for and set the password that was typed.
    const { error: pwError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
    });
    if (pwError) return { error: pwError.message };

    const { error: roleError } = await supabase.from("app_users").insert({
      user_id: existing.id,
      role: "recorder",
      email,
    });
    if (roleError) return { error: describe(roleError.message) };

    return {
      note: `${email} already had a sign-in with no access. It is now a recorder, with the password you set.`,
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
    role: "recorder",
    email,
  });
  if (error) {
    // Leave nothing half-made: an account that can sign in but has no role
    // lands on the no-access page with no way forward.
    await supabase.auth.admin.deleteUser(userId);
    return { error: describe(error.message) };
  }

  return { created: email };
}

/** Turns the one database error worth explaining into plain words. */
function describe(message: string) {
  if (/app_users_role_check/.test(message)) {
    return "The database does not know the recorder role yet — run supabase/recorder_accounts.sql first.";
  }
  return message;
}

export async function createRecorderAccount(fd: FormData) {
  await requireFederation();
  const outcome = await attemptCreate(fd);
  revalidatePath("/admin/recorders");
  // redirect throws to unwind, so it stays outside anything that catches.
  redirect(`/admin/recorders?${new URLSearchParams(outcome as any)}`);
}

/** Removes a recorder login entirely — the role and the account behind it. */
export async function revokeRecorderAccount(userId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("app_users")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();
  // Never let this be turned on a federation or club account.
  if (!row || row.role !== "recorder") {
    redirect("/admin/recorders?error=That+is+not+a+recorder+account.");
  }

  await supabase.from("app_users").delete().eq("user_id", userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  revalidatePath("/admin/recorders");
  redirect(
    error
      ? `/admin/recorders?${new URLSearchParams({ error: error.message })}`
      : "/admin/recorders?note=Login+revoked."
  );
}

/** Sets a new password, for when a recorder has lost theirs. */
export async function resetRecorderPassword(userId: string, fd: FormData) {
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
  } else if (!row || row.role !== "recorder") {
    outcome = { error: "That is not a recorder account." };
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (!error) {
      // The one account change with no row for a trigger to see: the
      // password lives in auth.users, which the audit triggers do not cover.
      await record({
        action: "account.password_reset",
        entity: "app_users",
        entityId: userId,
        summary: `Set a new password for ${row.email ?? "an account"}`,
      });
    }
    outcome = error
      ? { error: error.message }
      : { note: `New password set for ${row.email ?? "that recorder"}.` };
  }

  revalidatePath("/admin/recorders");
  redirect(`/admin/recorders?${new URLSearchParams(outcome as any)}`);
}

/**
 * Stops an account signing in without destroying it.
 *
 * The case this exists for: a club's login is issued before the season so
 * they can enter a squad, but must not work until they have paid. Deleting
 * and re-issuing would lose the password already handed over and everything
 * the account has done, so the account stays and the sign-in stops.
 */
export async function holdAccount(userId: string, fd: FormData) {
  await requireFederation();
  const reason = ((fd.get("reason") as string) ?? "").trim();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("app_users")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();

  let outcome: Outcome;
  if (!row || row.role !== "recorder") {
    outcome = { error: "That is not a recorder account." };
  } else {
    const { error } = await supabase
      .from("app_users")
      .update({ status: "on_hold", held_reason: reason || null, held_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      outcome = { error: missingHoldColumns(error.message) };
    } else {
      outcome = { note: `${row.email ?? "That account"} is on hold and cannot sign in.` };
    }
  }

  revalidatePath("/admin/recorders");
  redirect(`/admin/recorders?${new URLSearchParams(outcome as any)}`);
}

/** Lets a held account sign in again — the club has paid. */
export async function releaseAccount(userId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("app_users")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();

  let outcome: Outcome;
  if (!row || row.role !== "recorder") {
    outcome = { error: "That is not a recorder account." };
  } else {
    const { error } = await supabase
      .from("app_users")
      .update({ status: "active", held_reason: null, held_at: null })
      .eq("user_id", userId);
    if (error) {
      outcome = { error: missingHoldColumns(error.message) };
    } else {
      outcome = { note: `${row.email ?? "That account"} can sign in again.` };
    }
  }

  revalidatePath("/admin/recorders");
  redirect(`/admin/recorders?${new URLSearchParams(outcome as any)}`);
}

/** The one database error here worth explaining. */
function missingHoldColumns(message: string) {
  if (/status|held_reason|held_at/.test(message) && /column/i.test(message)) {
    return "Holds need supabase/account_holds_and_audit.sql to be run first.";
  }
  return message;
}
