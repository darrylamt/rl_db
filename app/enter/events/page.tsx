"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  NumberInput,
  Select,
  SubmitButton,
  Notice,
} from "@/components/FormFields";

type Fixture = {
  fixture_id: string;
  scheduled_date: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  competition: { name: string; season: string | null } | null;
};

type Player = {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string | null;
  jersey_number: number | null;
};

type Event = {
  event_id: string;
  event_type: string;
  minute: number | null;
  half: number | null;
  notes: string | null;
  created_at: string;
  player: { first_name: string; last_name: string } | null;
  team: { name: string } | null;
};

const EVENT_TYPES = [
  "try",
  "try_assist",
  "conversion",
  "penalty",
  "drop_goal",
  "tackle",
  "line_break",
  "sin_bin",
  "yellow_card",
  "red_card",
];

export default function EnterEventsPage() {
  const supabase = createClient();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureId, setFixtureId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [playerId, setPlayerId] = useState("");
  const [eventType, setEventType] = useState("try");
  const [minute, setMinute] = useState("");
  const [half, setHalf] = useState("1");

  const [status, setStatus] = useState<
    { kind: "error" | "success"; msg: string } | null
  >(null);
  const [loading, setLoading] = useState(false);

  // Load all fixtures
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name, season)"
        )
        .order("scheduled_date", { ascending: false })
        .limit(100);
      setFixtures((data ?? []) as any);
    })();
  }, [supabase]);

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.fixture_id === fixtureId) || null,
    [fixtures, fixtureId]
  );

  // Load players for the two teams in the selected fixture
  useEffect(() => {
    if (!selectedFixture) {
      setPlayers([]);
      return;
    }
    const teamIds = [
      selectedFixture.home_team_id,
      selectedFixture.away_team_id,
    ].filter(Boolean) as string[];
    if (teamIds.length === 0) {
      setPlayers([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("public_players")
        .select("player_id, first_name, last_name, team_id, jersey_number")
        .in("team_id", teamIds)
        .order("last_name");
      setPlayers((data ?? []) as any);
    })();
  }, [supabase, selectedFixture]);

  // Load + subscribe to events for the selected fixture (realtime)
  useEffect(() => {
    if (!fixtureId) {
      setEvents([]);
      return;
    }

    async function load() {
      const { data } = await supabase
        .from("match_events")
        .select(
          "event_id, event_type, minute, half, notes, created_at, player:player_id(first_name, last_name), team:team_id(name)"
        )
        .eq("fixture_id", fixtureId)
        .order("minute", { ascending: true });
      setEvents((data ?? []) as any);
    }
    load();

    const channel = supabase
      .channel(`events:${fixtureId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `fixture_id=eq.${fixtureId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fixtureId]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!fixtureId || !playerId) return;
    const p = players.find((x) => x.player_id === playerId);
    if (!p) return;

    setLoading(true);
    const { error } = await supabase.from("match_events").insert({
      fixture_id: fixtureId,
      player_id: playerId,
      team_id: p.team_id,
      event_type: eventType,
      minute: minute.trim() === "" ? null : parseInt(minute, 10),
      half: half.trim() === "" ? null : parseInt(half, 10),
    });
    setLoading(false);
    if (error) {
      setStatus({ kind: "error", msg: error.message });
      return;
    }
    setStatus({ kind: "success", msg: "Event added." });
    setPlayerId("");
    setMinute("");
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold mb-1">Enter Match Events</h1>
      <p className="text-navy-200 text-sm mb-6">
        Tries, conversions, cards. Updates live for everyone watching.
      </p>

      <Field label="Fixture">
        <Select
          value={fixtureId}
          onChange={(e) => setFixtureId(e.target.value)}
        >
          <option value="">— Select fixture —</option>
          {fixtures.map((f) => (
            <option key={f.fixture_id} value={f.fixture_id}>
              {f.home_team?.name} vs {f.away_team?.name} — {f.scheduled_date}
              {f.competition?.name ? ` (${f.competition.name}${f.competition.season ? ` ${f.competition.season}` : ""})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      {fixtureId && (
        <>
          <form
            onSubmit={addEvent}
            className="mt-6 bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3"
          >
            <Field label="Player">
              <Select
                required
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">— Select player —</option>
                {players.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.jersey_number ? `#${p.jersey_number} ` : ""}
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Event type">
              <Select
                required
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Minute">
                <NumberInput
                  min={0}
                  max={120}
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  placeholder="e.g. 23"
                />
              </Field>
              <Field label="Half">
                <Select
                  value={half}
                  onChange={(e) => setHalf(e.target.value)}
                >
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                </Select>
              </Field>
            </div>

            {status && <Notice kind={status.kind}>{status.msg}</Notice>}
            <SubmitButton loading={loading} disabled={!playerId}>
              Add Event
            </SubmitButton>
          </form>

          <section className="mt-6">
            <h2 className="font-display text-gold-400 text-sm tracking-widest mb-2">
              EVENTS SO FAR ({events.length})
            </h2>
            {events.length === 0 ? (
              <p className="text-navy-300 text-sm">
                No events logged yet.
              </p>
            ) : (
              <ul className="bg-navy-800 border border-navy-700 rounded-lg divide-y divide-navy-700">
                {events.map((ev) => (
                  <li
                    key={ev.event_id}
                    className="px-3 py-2.5 text-sm flex items-center gap-3"
                  >
                    <span className="font-mono text-gold-400 w-10 shrink-0">
                      {ev.minute != null ? `${ev.minute}'` : "—"}
                    </span>
                    <span className="font-medium capitalize">
                      {ev.event_type.replace("_", " ")}
                    </span>
                    <span className="text-navy-200">
                      {ev.player?.first_name} {ev.player?.last_name}
                    </span>
                    {ev.team?.name && (
                      <span className="text-navy-400 text-xs ml-auto">
                        {ev.team.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
