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
    category: str(fd, "category") ?? "senior_men",
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

export type BulkPlayerRow = {
  first_name: string;
  last_name: string;
  team_id?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  gender?: string;
  category?: string;
  playing_status?: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
};

export async function bulkCreatePlayers(
  rows: BulkPlayerRow[]
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let inserted = 0;

  for (const row of rows) {
    if (!row.first_name || !row.last_name) {
      errors.push(`Skipped row — missing first or last name`);
      continue;
    }
    const { error } = await supabase.from("players").insert({
      first_name: row.first_name,
      last_name: row.last_name,
      team_id: row.team_id || null,
      jersey_number: row.jersey_number ?? null,
      position: row.position || null,
      gender: row.gender || "male",
      category: row.category || "senior_men",
      playing_status: row.playing_status || "inactive",
      date_of_birth: row.date_of_birth || null,
      nationality: row.nationality || null,
      phone: row.phone || null,
      email: row.email || null,
      photo_url: row.photo_url || null,
    });
    if (error) {
      errors.push(`${row.first_name} ${row.last_name}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  revalidatePath("/admin/players");
  revalidatePath("/admin/dashboard");
  return { inserted, errors };
}
