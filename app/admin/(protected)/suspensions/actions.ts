"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}
function intOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function payload(fd: FormData) {
  return {
    player_id: str(fd, "player_id"),
    fixture_id: str(fd, "fixture_id"),
    reason: str(fd, "reason"),
    matches_banned: intOrNull(fd, "matches_banned"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    status: str(fd, "status") ?? "active",
    notes: str(fd, "notes"),
  };
}

export async function createSuspension(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.player_id) throw new Error("Player is required");
  const { error } = await supabase.from("suspensions").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suspensions");
}

export async function updateSuspension(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.player_id) throw new Error("Player is required");
  const { error } = await supabase.from("suspensions").update(p).eq("suspension_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suspensions");
  revalidatePath(`/admin/suspensions/${id}`);
}

export async function deleteSuspension(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("suspensions").delete().eq("suspension_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suspensions");
}

export async function markSuspensionStatus(id: string, status: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("suspensions").update({ status }).eq("suspension_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suspensions");
}
