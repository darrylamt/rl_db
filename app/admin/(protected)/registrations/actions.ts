"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function registerPlayer(fd: FormData) {
  const supabase = createAdminClient();
  const player_id = fd.get("player_id") as string;
  const season_year = parseInt(fd.get("season_year") as string, 10);
  const team_id = (fd.get("team_id") as string) || null;
  const notes = (fd.get("notes") as string)?.trim() || null;

  if (!player_id || !season_year) throw new Error("Player and year are required");

  const { error } = await supabase.from("player_registrations").upsert(
    { player_id, team_id, season_year, notes },
    { onConflict: "player_id,season_year" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/registrations");
}

export async function unregisterPlayer(registration_id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("player_registrations")
    .delete()
    .eq("registration_id", registration_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/registrations");
}

export async function bulkRegisterTeam(fd: FormData) {
  const supabase = createAdminClient();
  const team_id = fd.get("team_id") as string;
  const season_year = parseInt(fd.get("season_year") as string, 10);
  if (!team_id || !season_year) throw new Error("Team and year required");

  const { data: players } = await supabase
    .from("players")
    .select("player_id")
    .eq("team_id", team_id);

  if (!players?.length) throw new Error("No players found for this team");

  const rows = players.map((p) => ({ player_id: p.player_id, team_id, season_year }));
  const { error } = await supabase
    .from("player_registrations")
    .upsert(rows, { onConflict: "player_id,season_year" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/registrations");
}
