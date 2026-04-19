"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}
function intOrZero(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}
function intOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function payload(fd: FormData, fixture_id: string) {
  return {
    fixture_id,
    home_score: intOrZero(fd, "home_score"),
    away_score: intOrZero(fd, "away_score"),
    home_tries: intOrZero(fd, "home_tries"),
    away_tries: intOrZero(fd, "away_tries"),
    home_conversions: intOrZero(fd, "home_conversions"),
    away_conversions: intOrZero(fd, "away_conversions"),
    home_penalties: intOrZero(fd, "home_penalties"),
    away_penalties: intOrZero(fd, "away_penalties"),
    home_drop_goals: intOrZero(fd, "home_drop_goals"),
    away_drop_goals: intOrZero(fd, "away_drop_goals"),
    attendance: intOrNull(fd, "attendance"),
    notes: str(fd, "notes"),
    recorded_by: str(fd, "recorded_by"),
  };
}

export async function upsertResult(fixture_id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd, fixture_id);
  const { error } = await supabase.from("match_results").upsert(p, { onConflict: "fixture_id" });
  if (error) throw new Error(error.message);
  // Mark fixture completed
  await supabase.from("fixtures").update({ status: "completed" }).eq("fixture_id", fixture_id);
  revalidatePath("/admin/results");
  revalidatePath("/admin/fixtures");
  revalidatePath("/admin/standings");
  revalidatePath("/admin/dashboard");
}

export async function deleteResult(result_id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("match_results").delete().eq("result_id", result_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/results");
  revalidatePath("/admin/standings");
}
