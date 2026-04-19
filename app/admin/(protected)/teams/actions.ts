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

function payloadFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    region: str(fd, "region"),
    city: str(fd, "city"),
    founded_year: intOrNull(fd, "founded_year"),
    home_venue_id: str(fd, "home_venue_id"),
    manager_name: str(fd, "manager_name"),
    coach_name: str(fd, "coach_name"),
    logo_url: str(fd, "logo_url"),
  };
}

export async function createTeam(fd: FormData) {
  const supabase = createAdminClient();
  const payload = payloadFromForm(fd);
  if (!payload.name) throw new Error("Name is required");
  const { error } = await supabase.from("teams").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
  revalidatePath("/admin/dashboard");
}

export async function updateTeam(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const payload = payloadFromForm(fd);
  if (!payload.name) throw new Error("Name is required");
  const { error } = await supabase.from("teams").update(payload).eq("team_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
}

export async function deleteTeam(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").delete().eq("team_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
}
