"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { record } from "@/lib/audit";
import { PLAYER_REFERENCES } from "@/lib/duplicates";

const PAGE = "/admin/duplicates";

/** Details a player record carries that a merge must not throw away. */
const CARRIED = [
  "date_of_birth",
  "position",
  "secondary_positions",
  "email",
  "phone",
  "photo_url",
  "jersey_number",
  "nationality",
  "height_cm",
  "weight_kg",
  "gender",
] as const;

const blank = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0);

const isYouthCategory = (c: unknown) =>
  typeof c === "string" && c.toLowerCase().includes("youth");

/**
 * What the survivor should take from the record being dropped.
 *
 * Blanks are filled. Two things can genuinely disagree, and each has an
 * obvious answer:
 *
 *   grade  senior beats youth. The usual reason one person holds two records
 *          is that they came up from the youth side, and nobody moves back.
 *   club   a club beats a national side or a President's XIII. Those are
 *          selections, not where somebody is registered — and a record with
 *          no club at all takes whichever club the other one has.
 *
 * Anything else that differs is left as the survivor has it: the federation
 * chose that record, and second-guessing a deliberate choice is worse than
 * leaving one field for them to correct.
 */
async function reconcile(
  supabase: ReturnType<typeof createAdminClient>,
  keepId: string,
  dropId: string
): Promise<Record<string, unknown>> {
  const cols = ["player_id", "team_id", "category", ...CARRIED].join(", ");
  const { data } = await supabase
    .from("players")
    .select(cols)
    .in("player_id", [keepId, dropId]);
  const keep = (data ?? []).find((p: any) => p.player_id === keepId) as any;
  const drop = (data ?? []).find((p: any) => p.player_id === dropId) as any;
  if (!keep || !drop) return {};

  const patch: Record<string, unknown> = {};

  for (const field of CARRIED) {
    if (blank(keep[field]) && !blank(drop[field])) patch[field] = drop[field];
  }

  if (isYouthCategory(keep.category) && !blank(drop.category) && !isYouthCategory(drop.category)) {
    patch.category = drop.category;
  } else if (blank(keep.category) && !blank(drop.category)) {
    patch.category = drop.category;
  }

  if (blank(keep.team_id) && !blank(drop.team_id)) {
    patch.team_id = drop.team_id;
  } else if (!blank(keep.team_id) && !blank(drop.team_id) && keep.team_id !== drop.team_id) {
    const { data: sides } = await supabase
      .from("teams")
      .select("team_id, team_type")
      .in("team_id", [keep.team_id, drop.team_id]);
    const typeOf = new Map((sides ?? []).map((t: any) => [t.team_id, t.team_type]));
    const keepIsClub = typeOf.get(keep.team_id) === "club";
    const dropIsClub = typeOf.get(drop.team_id) === "club";
    if (!keepIsClub && dropIsClub) patch.team_id = drop.team_id;
  }

  return patch;
}

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

    // ── The player row itself ──
    // Moving the child rows is not the whole of a merge. The first version
    // stopped there and deleted the dropped record with everything on it:
    // Shadrack Aidoo's club, date of birth, position, email, phone and photo
    // all went, and his login ended up pointing at a clubless youth record.
    // Whatever the survivor lacks is taken from the record about to go.
    const patch = await reconcile(supabase, keepId, dropId);
    if (Object.keys(patch).length > 0) {
      // Contact details may be unique, and the dropped row still holds them
      // until it is deleted — so it lets go of them first.
      const released: Record<string, null> = {};
      if ("email" in patch) released.email = null;
      if ("phone" in patch) released.phone = null;
      if (Object.keys(released).length > 0) {
        await supabase.from("players").update(released).eq("player_id", dropId);
      }
      const { error: kept } = await supabase
        .from("players")
        .update(patch)
        .eq("player_id", keepId);
      if (kept) throw new Error(`Could not carry details across: ${kept.message}`);
      moved.push(`${Object.keys(patch).length} detail${Object.keys(patch).length === 1 ? "" : "s"} (${Object.keys(patch).join(", ")})`);
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
