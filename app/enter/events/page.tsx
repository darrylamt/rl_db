"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Fixture = {
  fixture_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  home_team_id: string;
  away_team_id: string;
  home_team: { name: string };
  away_team: { name: string };
  competition: { name: string; season: string | null } | null;
  status: string;
};

type Player = {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  jersey_number: number | null;
};

type Event = {
  event_id: string;
  event_type: string;
  minute: number | null;
  half: number | null;
  player: { first_name: string; last_name: string; jersey_number: number | null } | null;
  team: { name: string } | null;
};

const SCORE_EVENTS: { type: string; label: string; points: number; color: string }[] = [
  { type: "try",        label: "Try",        points: 4, color: "bg-emerald-600 hover:bg-emerald-700" },
  { type: "conversion", label: "Conversion", points: 2, color: "bg-blue-600 hover:bg-blue-700" },
  { type: "penalty",    label: "Penalty",    points: 2, color: "bg-amber-600 hover:bg-amber-700" },
  { type: "drop_goal",  label: "Drop Goal",  points: 1, color: "bg-purple-600 hover:bg-purple-700" },
];

const OTHER_EVENTS: { type: string; label: string; color: string }[] = [
  { type: "try_assist",  label: "Try Assist", color: "bg-slate-600 hover:bg-slate-700" },
  { type: "line_break",  label: "Line Break", color: "bg-slate-600 hover:bg-slate-700" },
  { type: "tackle",      label: "Tackle",     color: "bg-slate-600 hover:bg-slate-700" },
  { type: "sin_bin",     label: "Sin Bin",    color: "bg-yellow-500 hover:bg-yellow-600" },
  { type: "yellow_card", label: "Yellow Card",color: "bg-yellow-500 hover:bg-yellow-600" },
  { type: "red_card",    label: "Red Card",   color: "bg-red-600 hover:bg-red-700" },
];

function calcScore(events: Event[], teamId: string, allPlayers: Player[]) {
  let score = 0;
  const teamPlayerIds = new Set(allPlayers.filter(p => p.team_id === teamId).map(p => p.player_id));
  for (const e of events) {
    const p = (e.player as any)?.player_id;
    if (!p || !teamPlayerIds.has(p)) continue;
    const se = SCORE_EVENTS.find(s => s.type === e.event_type);
    if (se) score += se.points;
  }
  return score;
}

export default function EnterEventsPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixtureId, setFixtureId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // form state
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away" | "">("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [eventType, setEventType] = useState("");
  const [minute, setMinute] = useState("");
  const [half, setHalf] = useState<"1" | "2">("1");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // ── Load today's fixtures (+ postponed) ─────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, scheduled_time, status, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name, season)"
        )
        .or(`scheduled_date.eq.${today},status.eq.postponed,status.eq.live`)
        .order("scheduled_time", { ascending: true });
      setFixtures((data ?? []) as any);
    })();
  }, [supabase, today]);

  const fixture = useMemo(
    () => fixtures.find((f) => f.fixture_id === fixtureId) ?? null,
    [fixtures, fixtureId]
  );

  // ── Load players for the selected fixture ────────────────
  useEffect(() => {
    if (!fixture) { setPlayers([]); return; }
    const teamIds = [fixture.home_team_id, fixture.away_team_id].filter(Boolean);
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("player_id, first_name, last_name, team_id, jersey_number")
        .in("team_id", teamIds)
        .eq("playing_status", "active")
        .order("last_name");
      setPlayers((data ?? []) as any);
    })();
  }, [supabase, fixture]);

  // ── Realtime event feed ──────────────────────────────────
  const loadEvents = useCallback(async () => {
    if (!fixtureId) return;
    const { data } = await supabase
      .from("match_events")
      .select(
        "event_id, event_type, minute, half, player:player_id(player_id, first_name, last_name, jersey_number), team:team_id(name)"
      )
      .eq("fixture_id", fixtureId)
      .order("minute", { ascending: true, nullsFirst: false });
    setEvents((data ?? []) as any);
  }, [supabase, fixtureId]);

  useEffect(() => {
    if (!fixtureId) { setEvents([]); return; }
    loadEvents();
    const ch = supabase
      .channel(`live:${fixtureId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "match_events",
        filter: `fixture_id=eq.${fixtureId}`,
      }, () => loadEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fixtureId, loadEvents]);

  // ── Filtered player list ─────────────────────────────────
  const teamId = selectedTeam === "home" ? fixture?.home_team_id : fixture?.away_team_id;
  const teamPlayers = useMemo(
    () => players.filter((p) => p.team_id === teamId),
    [players, teamId]
  );
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return teamPlayers;
    const q = playerSearch.toLowerCase();
    return teamPlayers.filter(
      (p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        String(p.jersey_number ?? "").includes(q)
    );
  }, [teamPlayers, playerSearch]);

  const selectedPlayer = players.find((p) => p.player_id === playerId);

  // ── Live score ───────────────────────────────────────────
  const homeScore = fixture ? calcScore(events, fixture.home_team_id, players) : 0;
  const awayScore = fixture ? calcScore(events, fixture.away_team_id, players) : 0;

  // ── Submit event ─────────────────────────────────────────
  async function submitEvent() {
    if (!fixtureId || !playerId || !eventType) return;
    const p = players.find((x) => x.player_id === playerId);
    if (!p) return;
    setLoading(true);
    setNotice(null);
    const { error } = await supabase.from("match_events").insert({
      fixture_id: fixtureId,
      player_id: playerId,
      team_id: p.team_id,
      event_type: eventType,
      minute: minute ? parseInt(minute, 10) : null,
      half: parseInt(half, 10),
    });
    setLoading(false);
    if (error) { setNotice({ kind: "err", msg: error.message }); return; }
    setNotice({ kind: "ok", msg: `✓ ${eventType.replace("_", " ")} recorded` });
    setPlayerId("");
    setPlayerSearch("");
    setEventType("");
    setMinute("");
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Live Match Entry</h1>
      <p className="text-navy-200 text-sm mb-5">Recording events for today's fixtures.</p>

      {/* Fixture picker */}
      {fixtures.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-lg px-4 py-6 text-center text-navy-300 text-sm">
          No fixtures scheduled for today.
        </div>
      ) : (
        <div className="grid gap-2 mb-6">
          {fixtures.map((f) => {
            const active = f.fixture_id === fixtureId;
            const hTeam = (f.home_team as any)?.name ?? "?";
            const aTeam = (f.away_team as any)?.name ?? "?";
            return (
              <button
                key={f.fixture_id}
                onClick={() => {
                  setFixtureId(f.fixture_id);
                  setSelectedTeam("");
                  setPlayerId("");
                  setPlayerSearch("");
                  setEventType("");
                }}
                className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                  active
                    ? "bg-gold-500 border-gold-400 text-navy-900 font-semibold"
                    : "bg-navy-800 border-navy-700 text-white hover:bg-navy-700"
                }`}
              >
                <div className="font-medium">{hTeam} vs {aTeam}</div>
                <div className="text-xs opacity-70 mt-0.5">
                  {f.scheduled_time ? f.scheduled_time.slice(0, 5) : "—"}
                  {(f.competition as any)?.name ? ` · ${(f.competition as any).name}` : ""}
                  {f.status !== "scheduled" && (
                    <span className="ml-2 capitalize">[{f.status}]</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {fixture && (
        <>
          {/* Scoreboard */}
          <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 mb-4 text-center">
            <div className="grid grid-cols-3 items-center gap-2">
              <div className="text-right">
                <div className="text-sm text-navy-300">{(fixture.home_team as any)?.name}</div>
                <div className="font-display text-5xl font-bold text-white">{homeScore}</div>
              </div>
              <div className="text-navy-400 text-lg font-bold">–</div>
              <div className="text-left">
                <div className="text-sm text-navy-300">{(fixture.away_team as any)?.name}</div>
                <div className="font-display text-5xl font-bold text-white">{awayScore}</div>
              </div>
            </div>
          </div>

          {/* Team selector */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(["home", "away"] as const).map((side) => {
              const teamName = side === "home"
                ? (fixture.home_team as any)?.name
                : (fixture.away_team as any)?.name;
              return (
                <button
                  key={side}
                  onClick={() => { setSelectedTeam(side); setPlayerId(""); setPlayerSearch(""); }}
                  className={`py-2.5 rounded-lg text-sm font-semibold border transition ${
                    selectedTeam === side
                      ? "bg-white text-navy-900 border-white"
                      : "bg-navy-800 border-navy-600 text-navy-200 hover:bg-navy-700"
                  }`}
                >
                  {teamName}
                </button>
              );
            })}
          </div>

          {selectedTeam && (
            <>
              {/* Player search */}
              <div className="mb-3">
                <label className="block text-xs uppercase tracking-wider text-navy-400 mb-1">
                  Search Player
                </label>
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => { setPlayerSearch(e.target.value); setPlayerId(""); }}
                  placeholder="Name or jersey #..."
                  className="w-full px-3 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-navy-400 focus:outline-none focus:border-gold-400 text-sm"
                />
              </div>

              {/* Player grid */}
              {filteredPlayers.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 mb-4 max-h-48 overflow-y-auto">
                  {filteredPlayers.map((p) => (
                    <button
                      key={p.player_id}
                      onClick={() => setPlayerId(p.player_id)}
                      className={`text-left px-3 py-2 rounded-lg text-sm border transition ${
                        playerId === p.player_id
                          ? "bg-gold-500 border-gold-400 text-navy-900 font-semibold"
                          : "bg-navy-800 border-navy-700 text-white hover:bg-navy-700"
                      }`}
                    >
                      <span className="font-mono text-xs opacity-60">
                        {p.jersey_number != null ? `#${p.jersey_number}` : "—"}
                      </span>{" "}
                      {p.first_name} {p.last_name}
                    </button>
                  ))}
                </div>
              )}

              {teamPlayers.length === 0 && (
                <p className="text-navy-400 text-sm mb-4">
                  No active players found. Ensure players are registered and set to active.
                </p>
              )}
            </>
          )}

          {playerId && (
            <>
              {/* Minute + half */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-navy-400 mb-1">Minute</label>
                  <input
                    type="number"
                    min={1} max={120}
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    placeholder="e.g. 23"
                    className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white focus:outline-none focus:border-gold-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-navy-400 mb-1">Half</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(["1", "2"] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => setHalf(h)}
                        className={`py-2 rounded-lg text-sm font-semibold border ${
                          half === h
                            ? "bg-white text-navy-900 border-white"
                            : "bg-navy-800 border-navy-600 text-navy-300"
                        }`}
                      >
                        {h === "1" ? "1st" : "2nd"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected player indicator */}
              {selectedPlayer && (
                <div className="mb-3 px-3 py-2 bg-navy-700 rounded-lg text-sm text-gold-400 font-medium">
                  {selectedPlayer.jersey_number != null ? `#${selectedPlayer.jersey_number} ` : ""}
                  {selectedPlayer.first_name} {selectedPlayer.last_name}
                </div>
              )}

              {/* Scoring events */}
              <div className="mb-2">
                <p className="text-xs uppercase tracking-wider text-navy-400 mb-2">Scoring</p>
                <div className="grid grid-cols-2 gap-2">
                  {SCORE_EVENTS.map((ev) => (
                    <button
                      key={ev.type}
                      onClick={() => setEventType(ev.type)}
                      className={`py-3 rounded-lg text-sm font-bold text-white border-2 transition ${
                        eventType === ev.type
                          ? `${ev.color} border-white`
                          : `${ev.color} border-transparent opacity-80`
                      }`}
                    >
                      {ev.label}
                      <span className="block text-xs font-normal opacity-80">+{ev.points} pts</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Other events */}
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-navy-400 mb-2">Other</p>
                <div className="grid grid-cols-3 gap-2">
                  {OTHER_EVENTS.map((ev) => (
                    <button
                      key={ev.type}
                      onClick={() => setEventType(ev.type)}
                      className={`py-2.5 rounded-lg text-xs font-semibold text-white border-2 transition ${
                        eventType === ev.type
                          ? `${ev.color} border-white`
                          : `${ev.color} border-transparent opacity-80`
                      }`}
                    >
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>

              {notice && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm text-center ${
                  notice.kind === "ok"
                    ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700"
                    : "bg-red-900/50 text-red-300 border border-red-700"
                }`}>
                  {notice.msg}
                </div>
              )}

              <button
                onClick={submitEvent}
                disabled={!eventType || loading}
                className="w-full py-3.5 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:bg-navy-700 disabled:text-navy-400 text-navy-900 font-bold text-base transition"
              >
                {loading ? "Recording..." : eventType ? `Record ${eventType.replace(/_/g, " ")}` : "Select an event"}
              </button>
            </>
          )}

          {/* Live event feed */}
          {events.length > 0 && (
            <section className="mt-6">
              <h2 className="text-gold-400 font-display text-sm tracking-widest mb-2">
                EVENTS ({events.length})
              </h2>
              <div className="bg-navy-800 border border-navy-700 rounded-lg divide-y divide-navy-700 max-h-64 overflow-y-auto">
                {[...events].reverse().map((ev) => {
                  const p = ev.player as any;
                  const t = ev.team as any;
                  const se = SCORE_EVENTS.find((s) => s.type === ev.event_type);
                  return (
                    <div key={ev.event_id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                      <span className="font-mono text-gold-400 w-10 shrink-0 text-xs">
                        {ev.minute != null ? `${ev.minute}'` : "—"}
                      </span>
                      <span className={`font-semibold capitalize shrink-0 ${
                        ev.event_type === "red_card" ? "text-red-400" :
                        ev.event_type.includes("card") || ev.event_type === "sin_bin" ? "text-yellow-400" :
                        se ? "text-emerald-400" : "text-navy-200"
                      }`}>
                        {ev.event_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-white truncate">
                        {p?.first_name} {p?.last_name}
                      </span>
                      {t?.name && (
                        <span className="text-navy-400 text-xs ml-auto shrink-0">{t.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
