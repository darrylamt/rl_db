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

function slugify(v: string | null) {
  if (!v) return null;
  return v.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || null;
}

export async function createFixture(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.home_team_id || !p.away_team_id) throw new Error("Home and away teams are required");
  if (p.home_team_id === p.away_team_id) throw new Error("Home and away teams must be different");
  const { error } = await writeWithOptionalColumns(
    p,
    OPTIONAL_FIXTURE_COLUMNS,
    (values) => supabase.from("fixtures").insert(values)
  );
  if (error) throw new Error(error.message);
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
  revalidatePath("/admin/fixtures");
  revalidatePath(`/admin/fixtures/${id}`);
  revalidatePath("/admin/dashboard");
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
