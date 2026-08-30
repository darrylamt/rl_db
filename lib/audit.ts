import { createAdminClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";

/**
 * Records something an account did.
 *
 * Written with the service key, because audit_log is closed to every client
 * by design — a trail the subject could edit is not a trail.
 *
 * Never throws. An action that succeeded must not be reported as failed
 * because the note about it could not be filed, and the caller has usually
 * already changed the database by the time this runs.
 */
export async function record(entry: {
  action: string;
  entity?: string;
  entityId?: string | null;
  summary?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const actor = await getAppUser();
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      actor_id: actor?.userId ?? null,
      actor_email: actor?.email ?? null,
      actor_role: actor?.role ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    // Deliberately silent — see above.
  }
}
