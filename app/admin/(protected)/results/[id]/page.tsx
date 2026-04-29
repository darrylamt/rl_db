import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { ResultTabs } from "./ResultTabs";
import { upsertResult, addEvent, deleteEvent } from "../actions";

export default async function EditResultPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const [
    { data: fixture },
    { data: result },
    { data: events },
    { data: lineup },
  ] = await Promise.all([
    supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name)"
      )
      .eq("fixture_id", params.id)
      .maybeSingle(),
    supabase.from("match_results").select("*").eq("fixture_id", params.id).maybeSingle(),
    supabase
      .from("match_events")
      .select(
        "event_id, event_type, minute, half, notes, player:player_id(player_id, first_name, last_name), team:team_id(team_id, name)"
      )
      .eq("fixture_id", params.id)
      .order("half", { ascending: true })
      .order("minute", { ascending: true }),
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
  const homeTeamId: string = f.home?.team_id;
  const awayTeamId: string = f.away?.team_id;

  // Load all players for both teams for event/lineup selects
  const { data: homePlayers } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, jersey_number, position")
    .eq("team_id", homeTeamId)
    .eq("playing_status", "active")
    .order("last_name");

  const { data: awayPlayers } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, jersey_number, position")
    .eq("team_id", awayTeamId)
    .eq("playing_status", "active")
    .order("last_name");

  const boundUpsert = upsertResult.bind(null, params.id);
  const boundAddEvent = addEvent.bind(null, params.id);

  return (
    <ResultTabs
      fixtureId={params.id}
      fixture={f}
      result={result}
      events={events ?? []}
      lineup={lineup ?? []}
      homePlayers={homePlayers ?? []}
      awayPlayers={awayPlayers ?? []}
      upsertResult={boundUpsert}
      addEvent={boundAddEvent}
      deleteEvent={deleteEvent}
    />
  );
}