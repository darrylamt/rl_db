"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { resolveImageUrl } from "@/lib/upload";
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
function boolVal(fd: FormData, k: string) {
  return fd.get(k) === "on";
}

function payload(fd: FormData) {
  return {
    team_id: str(fd, "team_id"),
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    date_of_birth: str(fd, "date_of_birth"),
    height_cm: intOrNull(fd, "height_cm"),
    weight_kg: intOrNull(fd, "weight_kg"),
    nationality: str(fd, "nationality"),
    jersey_number: intOrNull(fd, "jersey_number"),
    position: str(fd, "position"),
    is_captain: boolVal(fd, "is_captain"),
    playing_status: str(fd, "playing_status") ?? "inactive",
    gender: str(fd, "gender") ?? "male",
    photo_url: null as string | null,
    phone: str(fd, "phone"),
    email: str(fd, "email"),
  };
}

export async function createPlayer(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  p.photo_url = await resolveImageUrl(fd, "photo", "player-photos", "players", null);
  const { error } = await supabase.from("players").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/players");
  revalidatePath("/admin/dashboard");
}

export async function updatePlayer(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("players")
    .select("photo_url")
    .eq("player_id", id)
    .maybeSingle();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  p.photo_url = await resolveImageUrl(fd, "photo", "player-photos", "players", existing?.photo_url);
  const { error } = await supabase.from("players").update(p).eq("player_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${id}`);
}

export async function deletePlayer(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("players").delete().eq("player_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/players");
}
