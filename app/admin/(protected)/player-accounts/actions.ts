"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";

type Outcome = { error: string } | { note: string };

const PAGE = "/admin/player-accounts";
const SHARED = "RLFG@08";

function done(outcome: Outcome, q?: string) {
  const params = new URLSearchParams(outcome as any);
  if (q) params.set("q", q);
  revalidatePath(PAGE);
  redirect(`${PAGE}?${params}`);
}

/** Only a player account, ever. */
async function playerAccount(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_users")
    .select("user_id, role, email, player_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data as any).role !== "player") return null;
  return data as any;
}

/**
 * Puts an account back on the shared password.
 *
 * For the player who has forgotten theirs. It is set back to the one
 * everybody started on and flagged again, so the next sign-in has to change
 * it — the shared password is never left standing as somebody's real one.
 */
export async function resetPlayerPassword(userId: string, fd: FormData) {
  await requireFederation();
  const q = ((fd.get("q") as string) ?? "").trim() || undefined;
  const supabase = createAdminClient();

  const account = await playerAccount(userId);
  if (!account) done({ error: "That is not a player account." }, q);

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: SHARED,
  });
  if (error) done({ error: error.message }, q);

  await supabase
    .from("app_users")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  done(
    {
      note: `${account.email} is back on ${SHARED} and will be asked to change it.`,
    },
    q
  );
}

/** Removes a player's login. The player record itself is untouched. */
export async function revokePlayerAccount(userId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const account = await playerAccount(userId);
  if (!account) done({ error: "That is not a player account." });

  await supabase.from("app_users").delete().eq("user_id", userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);

  done(
    error
      ? { error: error.message }
      : { note: `${account.email} can no longer sign in. The player is still on record.` }
  );
}

/**
 * Gives a login to a player who has none.
 *
 * The seed covers everyone active at the time it ran; this is for the ones
 * who arrive afterwards.
 */
export async function createPlayerAccount(playerId: string, fd: FormData) {
  await requireFederation();
  const q = ((fd.get("q") as string) ?? "").trim() || undefined;
  const supabase = createAdminClient();

  const { data: player } = await supabase
    .from("players")
    .select("player_id, first_name, last_name")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!player) done({ error: "That player no longer exists." }, q);

  const slug = (s: string | null) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const p = player as any;
  const stem = [slug(p.first_name), slug(p.last_name)].filter(Boolean).join(".");
  if (!stem) done({ error: "That player has no usable name for an address." }, q);

  // A name already in use gets a number, the same way the seed does it.
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const taken = new Set(
    (existing?.users ?? []).map((u) => (u.email ?? "").toLowerCase())
  );
  let email = `${stem}@rlfg.com`;
  let n = 2;
  while (taken.has(email)) email = `${stem}${n++}@rlfg.com`;

  const { data: made, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: SHARED,
    email_confirm: true,
  });
  if (authError) done({ error: authError.message }, q);

  const { error: roleError } = await supabase.from("app_users").insert({
    user_id: made!.user!.id,
    role: "player",
    player_id: playerId,
    email,
    must_change_password: true,
  });

  if (roleError) {
    // Leave nothing half-made.
    await supabase.auth.admin.deleteUser(made!.user!.id);
    done({ error: roleError.message }, q);
  }

  done({ note: `${email} created on ${SHARED}.` }, q);
}
