"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";

/** Where each kind of account lands once its password is its own. */
function homeFor(role: string) {
  if (role === "club") return "/club";
  if (role === "recorder") return "/enter";
  if (role === "player") return "/player";
  return "/admin/dashboard";
}

/**
 * Changes the password, for any kind of account.
 *
 * Every password the federation sets — a new login, or a reset for somebody
 * who lost theirs — is one the federation also knows. So the account is
 * flagged, and this is the only page it can reach until the person behind it
 * has picked one nobody else knows.
 */
export async function changeOwnPassword(fd: FormData) {
  const user = await getAppUser();
  if (!user) redirect("/admin/login");

  const password = (fd.get("password") as string) ?? "";
  const again = (fd.get("again") as string) ?? "";

  let error: string | null = null;
  if (password.length < 8) {
    error = "Pick something at least 8 characters long.";
  } else if (password !== again) {
    error = "Those two do not match.";
  } else if (password === "RLFG@08") {
    error = "That is the shared one everybody starts with. Pick your own.";
  } else {
    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      // Supabase refuses the password it already has, which is the point:
      // the one the federation handed over is not allowed back.
      error = /different from the old/i.test(authError.message)
        ? "That is the password you were given. Pick a new one only you know."
        : authError.message;
    } else {
      await createAdminClient()
        .from("app_users")
        .update({ must_change_password: false })
        .eq("user_id", user.userId);
      redirect(`${homeFor(user.role)}?note=Password+changed.+Welcome+in.`);
    }
  }

  redirect(`/account/password?${new URLSearchParams({ error: error ?? "Try again." })}`);
}
