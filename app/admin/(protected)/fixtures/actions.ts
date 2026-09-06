"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeWithOptionalColumns } from "@/lib/optionalColumns";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function payload(fd: FormData) {
  return {
    competition_id: str(fd, "competition_id"),
    home_team_id: str(fd, "home_team_id"),
    away_team_id: str(fd, "away_team_id"),
    venue_id: str(fd, "venue_id"),
    scheduled_date: str(fd, "scheduled_date"),
    scheduled_time: str(fd, "scheduled_time"),
    round: str(fd, "round"),
    status: str(fd, "status") ?? "scheduled",
    // Readable id used by the public website: /fixtures/<slug>.
    // Leave blank and one is generated from the teams and date.
    slug: slugify(str(fd, "slug")),
  };
}

// Added by integration_schema.sql; a deploy can land before the migration.
const OPTIONAL_FIXTURE_COLUMNS = ["slug"] as const;

/**
 * Writes who was on the game.
 *
 * The three roles are rewritten together rather than merged: the form always
 * posts all of them, so a blank field means "take this official off", and
 * replacing the set is the only reading that lets you undo a mistake.
 *
 * A failure here does not fail the fixture. The match details are what the
 * save was for, and losing them because an official could not be recorded
 * would be the wrong trade — the fields simply come back empty to try again.
 */
async function saveOfficials(fixtureId: string, fd: FormData) {
  const supabase = createAdminClient();
  // The form said nothing about officials, which is not the same as saying
  // there are none. Only a form that carried the fields may clear them.
  if (!fd.get("officials_present")) return;
  const roles = ["referee", "touch_judge_1", "touch_judge_2"] as const;

  const rows = roles
    .map((role) => ({ role, official_id: str(fd, role) }))
    .filter((r) => r.official_id)
    .map((r) => ({ fixture_id: fixtureId, role: r.role, official_id: r.official_id }));

  await supabase.from("fixture_officials").delete().eq("fixture_id", fixtureId);
  if (rows.length > 0) await supabase.from("fixture_officials").insert(rows);
}

/**
 * Writes who was in charge of each side.
 *
 * Clubs set their own coach on a team sheet, but that only reaches matches
 * still to come — an approved sheet is locked to the club, and every past
 * match is approved. Two thirds of past sides have no sheet at all. This is
 * the federation's way in, for a match of any age.
 *
 * Where a side has no sheet, one is created as a draft. Deliberately not
 * approved: recording who coached a game is not signing off a side, and a
 * future match must stay open for the club that has yet to name one. An
 * existing sheet keeps whatever status it already had.
 *
 * A posted coach is checked against the club it is being set for, so a coach
 * tied to one club cannot be recorded against another.
 */
async function saveCoaches(
  fixtureId: string,
  sides: { key: "home" | "away"; teamId: string | null }[],
  fd: FormData
) {
  const supabase = createAdminClient();
  // As above: a form with no coach pickers on it is silent, not empty.
  if (!fd.get("coaches_present")) return;

  for (const side of sides) {
    if (!side.teamId) continue;

    const head = str(fd, `${side.key}_head_coach_id`);
    const assistant = str(fd, `${side.key}_assistant_coach_id`);

    // Nothing asked for and nothing to undo: leave the sheet alone rather
    // than creating an empty one for every match that is saved.
    const { data: sheet } = await supabase
      .from("team_sheets")
      .select("sheet_id, head_coach_id, assistant_coach_id")
      .eq("fixture_id", fixtureId)
      .eq("team_id", side.teamId)
      .maybeSingle();

    const nothingSet = !head && !assistant;
    const nothingStored =
      !sheet ||
      (!(sheet as any).head_coach_id && !(sheet as any).assistant_coach_id);
    if (nothingSet && nothingStored) continue;

    // Only coaches this club may actually be given.
    const asked = [head, assistant].filter(Boolean) as string[];
    const allowed = new Set<string>();
    if (asked.length > 0) {
      const { data: ok } = await supabase
        .from("coaches")
        .select("coach_id")
        .in("coach_id", asked)
        .or(`team_id.eq.${side.teamId},team_id.is.null`);
      for (const c of (ok ?? []) as any[]) allowed.add(c.coach_id);
    }

    const values = {
      head_coach_id: head && allowed.has(head) ? head : null,
      assistant_coach_id:
        assistant && allowed.has(assistant) ? assistant : null,
    };

    if (sheet) {
      await supabase
        .from("team_sheets")
        .update(values)
        .eq("sheet_id", (sheet as any).sheet_id);
    } else {
      await supabase.from("team_sheets").insert({
        fixture_id: fixtureId,
        team_id: side.teamId,
        status: "draft",
        ...values,
      });
    }
  }
}

function slugify(v: string | null) {
  if (!v) return null;
  return v.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || null;
}

export async function createFixture(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.home_team_id || !p.away_team_id) throw new Error("Home and away teams are required");
  if (p.home_team_id === p.away_team_id) throw new Error("Home and away teams must be different");
  // Held on an object rather than a bare local: the id is assigned inside a
  // callback, and a plain `let` initialised to null narrows to never once the
  // compiler has seen only that.
  const created: { id: string | null } = { id: null };
  const { error } = await writeWithOptionalColumns(
    p,
    OPTIONAL_FIXTURE_COLUMNS,
    async (values) => {
      const res = await supabase
        .from("fixtures")
        .insert(values)
        .select("fixture_id")
        .maybeSingle();
      created.id = (res.data as any)?.fixture_id ?? null;
      return { error: res.error };
    }
  );
  if (error) throw new Error(error.message);
  if (created.id) await saveOfficials(created.id, fd);
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/dashboard");
}

export async function updateFixture(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.home_team_id || !p.away_team_id) throw new Error("Home and away teams are required");
  if (p.home_team_id === p.away_team_id) throw new Error("Home and away teams must be different");
  const { error } = await writeWithOptionalColumns(
    p,
    OPTIONAL_FIXTURE_COLUMNS,
    (values) => supabase.from("fixtures").update(values).eq("fixture_id", id)
  );
  if (error) throw new Error(error.message);
  await saveOfficials(id, fd);
  await saveCoaches(
    id,
    [
      { key: "home", teamId: p.home_team_id },
      { key: "away", teamId: p.away_team_id },
    ],
    fd
  );
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/team-sheets");
  revalidatePath("/club/team-sheets");
  revalidatePath(`/admin/fixtures/${id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/live");
}

export async function bulkCreateFixtures(fd: FormData) {
  const supabase = createAdminClient();
  const raw = fd.get("fixtures_json");
  if (typeof raw !== "string" || !raw) throw new Error("No fixture data received");

  let rows: any[];
  try { rows = JSON.parse(raw); } catch { throw new Error("Invalid fixture data"); }

  if (!Array.isArray(rows) || rows.length === 0) throw new Error("No fixtures to create");

  const valid = rows.filter(
    (r) => r.home_team_id && r.away_team_id && r.home_team_id !== r.away_team_id
  );
  if (valid.length === 0) throw new Error("No valid fixtures — check each row has different home and away teams");

  const { error } = await supabase.from("fixtures").insert(valid);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/dashboard");
}

export async function deleteFixture(id: string) {
  const supabase = createAdminClient();
  // Delete dependents first (no cascade on match_results/events/officials)
  await supabase.from("match_events").delete().eq("fixture_id", id);
  await supabase.from("fixture_officials").delete().eq("fixture_id", id);
  await supabase.from("match_results").delete().eq("fixture_id", id);
  // match_lineups has ON DELETE CASCADE but delete explicitly to be safe
  await supabase.from("match_lineups").delete().eq("fixture_id", id);
  const { error } = await supabase.from("fixtures").delete().eq("fixture_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/dashboard");
}
