import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { LineupEditor } from "./LineupEditor";
import { addToLineup, removeFromLineup } from "./actions";

export default async function LineupPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const [{ data: fixture }, { data: lineup }] = await Promise.all([
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name)"
      )
      .eq("fixture_id", params.id)
      .maybeSingle(),
    supabase
      .from("match_lineups")
      .select(
        "lineup_id, jersey_number, position, is_starter, player:player_id(player_id, first_name, last_name), team:team_id(team_id, name)"
      )
      .eq("fixture_id", params.id)
      .order("is_starter", { ascending: false })
      .order("jersey_number", { ascending: true }),
  ]);

  if (!fixture) notFound();

  const f: any = fixture;
  const homeTeam = Array.isArray(f.home) ? f.home[0] : f.home;
  const awayTeam = Array.isArray(f.away) ? f.away[0] : f.away;

  // Load all active players for both teams
  const [{ data: homePlayers }, { data: awayPlayers }] = await Promise.all([
    supabase
      .from("players")
      .select("player_id, first_name, last_name, jersey_number, position")
      .eq("team_id", homeTeam.team_id)
      .eq("playing_status", "active")
      .order("last_name"),
    supabase
      .from("players")
      .select("player_id, first_name, last_name, jersey_number, position")
      .eq("team_id", awayTeam.team_id)
      .eq("playing_status", "active")
      .order("last_name"),
  ]);

  return (
    <LineupEditor
      fixtureId={params.id}
      fixture={f}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      lineup={lineup ?? []}
      homePlayers={homePlayers ?? []}
      awayPlayers={awayPlayers ?? []}
      addToLineup={addToLineup}
      removeFromLineup={removeFromLineup}
    />
  );
}