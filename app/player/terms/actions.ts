"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { writeWithOptionalColumns } from "@/lib/optionalColumns";
import { TERMS_VERSION } from "@/lib/terms";

/**
 * Records the answer either way.
 *
 * A refusal is written down before the session ends, because "asked and
 * declined" is a fact somebody may need later and it cannot be recovered
 * from an empty table.
 */
export async function decideTerms(fd: FormData) {
  const user = await getAppUser();
  if (!user) redirect("/admin/login");

  const accepted = fd.get("decision") === "accept";
  const supabase = createAdminClient();

  // The table arrives with supabase/player_terms.sql. Until it is run the
  // answer is not recorded, which is a gap in the record rather than a reason
  // to fail somebody at the door.
  const { error: logError } = await supabase
    .from("player_terms_decisions")
    .insert({
      user_id: user.userId,
      player_id: user.playerId ?? null,
      version: TERMS_VERSION,
      accepted,
    });
  if (logError && !/relation .* does not exist/i.test(logError.message)) {
    throw new Error(logError.message);
  }

  if (!accepted) {
    // Nothing is stamped on the account: they have not accepted this version,
    // so signing in again asks them again.
    await createClient().auth.signOut();
    redirect("/admin/login?declined=1");
  }

  await writeWithOptionalColumns(
    { terms_version: TERMS_VERSION },
    ["terms_version"] as const,
    (values) =>
      supabase.from("app_users").update(values).eq("user_id", user.userId)
  );

  redirect("/player");
}
