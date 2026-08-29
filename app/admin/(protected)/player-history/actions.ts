"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function payload(fd: FormData) {
  return {
    player_id: str(fd, "player_id"),
    team_id: str(fd, "team_id"),
    season: str(fd, "season"),
    role: str(fd, "role"),
    joined_date: str(fd, "joined_date"),
    left_date: str(fd, "left_date"),
    notes: str(fd, "notes"),
  };
}

export async function createPlayerHistory(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.player_id) throw new Error("Player is required");
  const { error } = await supabase.from("player_history").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/player-history");
}

export async function updatePlayerHistory(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.player_id) throw new Error("Player is required");
  const { error } = await supabase.from("player_history").update(p).eq("history_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/player-history");
  revalidatePath(`/admin/player-history/${id}`);
}

export async function deletePlayerHistory(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("player_history").delete().eq("history_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/player-history");
}
