"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addToLineup(fd: FormData) {
  const supabase = createAdminClient();
  const fixture_id = fd.get("fixture_id") as string;
  const team_id = fd.get("team_id") as string;
  const player_id = fd.get("player_id") as string;
  const jersey_number = fd.get("jersey_number")
    ? parseInt(fd.get("jersey_number") as string, 10)
    : null;
  const position = (fd.get("position") as string)?.trim() || null;
  const is_starter = fd.get("is_starter") === "true";

  if (!fixture_id || !team_id || !player_id) throw new Error("Missing required fields");

  const { error } = await supabase.from("match_lineups").upsert(
    { fixture_id, team_id, player_id, jersey_number, position, is_starter },
    { onConflict: "fixture_id,team_id,player_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/fixtures/${fixture_id}/lineup`);
}

export async function removeFromLineup(lineup_id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("match_lineups")
    .select("fixture_id")
    .eq("lineup_id", lineup_id)
    .maybeSingle();
  const { error } = await supabase
    .from("match_lineups")
    .delete()
    .eq("lineup_id", lineup_id);
  if (error) throw new Error(error.message);
  if (data?.fixture_id) revalidatePath(`/admin/fixtures/${data.fixture_id}/lineup`);
}
