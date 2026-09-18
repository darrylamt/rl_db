"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { record } from "@/lib/audit";
import { PLAYER_REFERENCES } from "@/lib/duplicates";

const PAGE = "/admin/duplicates";

/**
 * Folds one player record into another.
 *
 * Everything pointing at the record being dropped is moved first — events,
 * line-ups, history, registrations, contracts, the lot — so no appearance or
 * statistic is lost. Only then does the empty record go.
 *
 * The earlier dedupe migration moved six tables. There are twelve, and the
 * six it missed include contracts and logins, so a merge done its way would
 * have deleted a player's contract history along with the duplicate.
 *
 * Deliberately not reversible in one click, which is why the page insists on
 * a deliberate choice of survivor rather than guessing. The audit trigger
 * keeps the deleted row in full, so it can be reconstructed if a merge turns
 * out to be wrong.
 */
export async function mergePlayers(keepId: string, dropId: string) {
  await requireFederation();
  const supabase = createAdminClient();

  let outcome: { error: string } | { note: string };
  try {
    if (!keepId || !dropId) throw new Error("Two players are needed.");
    if (keepId === dropId) throw new Error("That is the same record twice.");

    const { data: both } = await supabase
      .from("players")
      .select("player_id, first_name, last_name")
      .in("player_id", [keepId, dropId]);
    if ((both ?? []).length !== 2) {
      throw new Error("One of those records no longer exists.");
    }

    const name = (id: string) => {
      const p = (both ?? []).find((x: any) => x.player_id === id) as any;
      return `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "a player";
    };

    // Move everything across, table by table. A table that does not exist
    // yet — a migration not run — is skipped rather than failing the merge.
    const moved: string[] = [];
    for (const table of PLAYER_REFERENCES) {
      const { error, count } = await supabase
        .from(table)
        .update({ player_id: keepId }, { count: "exact" })
        .eq("player_id", dropId);
      if (error) {
        if ((error as any).code === "42P01" || (error as any).code === "PGRST205") {
          continue;
        }
        throw new Error(`${table}: ${error.message}`);
      }
      if ((count ?? 0) > 0) moved.push(`${count} from ${table.replace(/_/g, " ")}`);
    }

    const { error: gone } = await supabase
      .from("players")
      .delete()
      .eq("player_id", dropId);
    if (gone) throw new Error(gone.message);

    await record({
      action: "players.merge",
      entity: "players",
      entityId: keepId,
      summary: `Merged ${name(dropId)} into ${name(keepId)} — one person held two records`,
      detail: { kept: keepId, dropped: dropId, moved },
    });

    outcome = {
      note:
        `${name(dropId)} folded into ${name(keepId)}.` +
        (moved.length > 0 ? ` Moved ${moved.join(", ")}.` : " Nothing was attached to it."),
    };
  } catch (e: any) {
    outcome = { error: e.message ?? String(e) };
  }

  revalidatePath(PAGE);
  revalidatePath("/admin/players");
  revalidatePath("/live/values");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}
