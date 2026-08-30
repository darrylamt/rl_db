"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchClockPanel } from "@/components/enter/MatchClockPanel";
import { TallyPad } from "@/components/enter/TallyPad";
import { clockState, displayMinute, currentHalf } from "@/lib/matchClock";
import { byMatchTime, halfForMinute } from "@/lib/matchStats";

type Fixture = {
  fixture_id: string;
  kickoff_at?: string | null;
  clock_state?: string | null;
  paused_at?: string | null;
  stoppage_seconds?: number | null;
  forfeited_by_team_id?: string | null;
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

/** A client-side id, so a retry cannot become a second event. */
function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const SCORE_EVENTS: { type: string; label: string; points: number; color: string }[] = [
  { type: "try",        label: "Try",        points: 4, color: "bg-emerald-600 hover:bg-emerald-700" },
  { type: "conversion", label: "Conversion", points: 2, color: "bg-blue-600 hover:bg-blue-700" },
  { type: "penalty_goal", label: "Penalty", points: 2, color: "bg-amber-600 hover:bg-amber-700" },
  { type: "drop_goal",  label: "Drop Goal",  points: 1, color: "bg-purple-600 hover:bg-purple-700" },
];

const OTHER_EVENTS: { type: string; label: string; color: string }[] = [
  { type: "missed_conversion", label: "Missed Conv.", color: "bg-slate-600 hover:bg-slate-700" },
  { type: "try_assist",  label: "Try Assist", color: "bg-slate-600 hover:bg-slate-700" },
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
  // The id this event will carry, held across retries — see submitEvent.
  const [pendingId, setPendingId] = useState<string | null>(null);

  // ── Load today's fixtures (+ postponed) ─────────────────
  // A recorder normally arrives from the match-day list with the match
  // already named: /enter/events?fixture=<id>. That one is pulled in even if
  // it is not today's, so following the link never lands on an empty picker.
  // Both go in a single effect: two effects racing to setFixtures would let
  // the slower one wipe the other's result.
  useEffect(() => {
    (async () => {
      const wanted =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("fixture");

      const { data } = await supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, scheduled_time, status, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name, season), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id"
        )
        .or(`scheduled_date.eq.${today},status.eq.postponed,status.eq.live`)
        .order("scheduled_time", { ascending: true });

      let list = (data ?? []) as any[];

      if (wanted && !list.some((f) => f.fixture_id === wanted)) {
        const { data: one } = await supabase
          .from("fixtures")
          .select(
            "fixture_id, scheduled_date, scheduled_time, status, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name, season), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id"
          )
          .eq("fixture_id", wanted)
          .maybeSingle();
        if (one) list = [one as any, ...list];
      }

      setFixtures(list as any);
      if (wanted && list.some((f) => f.fixture_id === wanted)) setFixtureId(wanted);
    })();
  }, [supabase, today]);

  const fixture = useMemo(
    () => fixtures.find((f) => f.fixture_id === fixtureId) ?? null,
    [fixtures, fixtureId]
  );

  /** Pull this fixture back after the clock moves, so the panel is current. */
  const reloadFixture = useCallback(async () => {
    if (!fixtureId) return;
    const { data } = await supabase
      .from("fixtures")
      .select(
        "fixture_id, scheduled_date, scheduled_time, status, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name, season), kickoff_at, clock_state, paused_at, stoppage_seconds, forfeited_by_team_id"
      )
      .eq("fixture_id", fixtureId)
      .maybeSingle();
    if (data) {
      setFixtures((cur) =>
        cur.map((f) => (f.fixture_id === fixtureId ? ({ ...f, ...(data as any) }) : f))
      );
    }
  }, [supabase, fixtureId]);

  // While the clock runs, the minute box follows it — until the recorder
  // types their own. An event entered late belongs to the minute it
  // happened, not the minute it was typed.
  const [minuteTouched, setMinuteTouched] = useState(false);
  useEffect(() => {
    if (!fixture || minuteTouched) return;
    if (clockState(fixture) !== "running") return;
    const set = () => {
      setMinute(String(displayMinute(fixture)));
      setHalf(String(currentHalf(fixture)) as "1" | "2");
    };
    set();
    const id = setInterval(set, 15000);
    return () => clearInterval(id);
  }, [fixture, minuteTouched]);

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
  /**
   * Records one event, once.
   *
   * A tap on a phone at a ground is easy to repeat — a slow response, a
   * fat finger, a lost signal and a retry — and a try entered twice puts
   * the score wrong on the public page.
   *
   * The id is generated here rather than by the database, so a second send
   * of the same event carries the same primary key and the database refuses
   * it. That is what makes this safe to press twice; disabling the button
   * only narrows the window, it does not close it. A fresh id is taken once
   * a recording has actually landed, so the next event is a new one.
   */
  async function submitEvent() {
    if (!fixtureId || !playerId || !eventType || loading) return;
    const p = players.find((x) => x.player_id === playerId);
    if (!p) return;

    const id = pendingId ?? newId();
    if (!pendingId) setPendingId(id);

    setLoading(true);
    setNotice(null);
    const { error } = await supabase.from("match_events").insert({
      event_id: id,
      fixture_id: fixtureId,
      player_id: playerId,
      team_id: p.team_id,
      event_type: eventType,
      minute: minute ? parseInt(minute, 10) : null,
      half: parseInt(half, 10),
    });
    setLoading(false);

    // 23505 is a duplicate key: this exact event is already recorded, which
    // is the outcome the recorder wanted. Reporting it as a failure would
    // invite them to press again.
    if (error && (error as any).code !== "23505") {
      setNotice({ kind: "err", msg: error.message });
      return;
    }

    setNotice({ kind: "ok", msg: `✓ ${eventType.replace("_", " ")} recorded` });
    setPendingId(null);
    setMinuteTouched(false);
    setPlayerId("");
    setPlayerSearch("");
    setEventType("");
    setMinute("");
    setTimeout(() => setNotice(null), 3000);
  }

  /**
   * Removes an event that should not have been recorded.
   *
   * Entered in the wrong minute, against the wrong player, or twice from two
   * devices — whatever the reason, the recorder is the one standing there and
   * the public page is showing it, so they can take it straight back out.
   */
  async function deleteEvent(ev: Event) {
    const who = [ev.player?.first_name, ev.player?.last_name].filter(Boolean).join(" ");
    const what = ev.event_type.replace(/_/g, " ");
    if (!confirm(`Remove the ${what}${who ? ` by ${who}` : ""}? The live page updates straight away.`)) {
      return;
    }
    const { error } = await supabase
      .from("match_events")
      .delete()
      .eq("event_id", ev.event_id);
    if (error) { setNotice({ kind: "err", msg: error.message }); return; }
    setNotice({ kind: "ok", msg: `✓ ${what} removed` });
    loadEvents();
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
        <MatchClockPanel fixture={fixture as any} onChange={reloadFixture} />
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

          {/* Scoring and cards — the form below opens once a side is picked */}
          <h3 className="text-gold-400 font-display text-sm tracking-widest mb-2">
            SCORING &amp; CARDS
          </h3>
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
                    onChange={(e) => {
                      setMinuteTouched(true);
                      setMinute(e.target.value);
                      const m = parseInt(e.target.value, 10);
                      if (!Number.isNaN(m)) setHalf(String(halfForMinute(m)) as "1" | "2");
                    }}
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

          {!selectedTeam && (
            <p className="bg-navy-800/60 border border-navy-600 border-dashed rounded-lg px-4 py-5 text-center text-sm text-navy-300 mb-2">
              Pick a side above to record a try, conversion, card or missed
              conversion.
            </p>
          )}

          {/* Live event feed */}
          {/* The counting stats. Kept apart from the form above because they
              are a different job: one tap each, hundreds of times. */}
          <section className="mt-6">
            <TallyPad
              fixtureId={fixtureId}
              fixture={fixture}
              players={players}
              events={events}
              onRecorded={loadEvents}
            />
          </section>

          {events.length > 0 && (
            <section className="mt-6">
              <h2 className="text-gold-400 font-display text-sm tracking-widest mb-2">
                EVENTS ({events.length})
              </h2>
              <div className="bg-navy-800 border border-navy-700 rounded-lg divide-y divide-navy-700 max-h-64 overflow-y-auto">
                {[...events].sort(byMatchTime).reverse().map((ev) => {
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
                      <button
                        type="button"
                        onClick={() => deleteEvent(ev)}
                        aria-label="Remove this event"
                        className={`shrink-0 text-navy-400 hover:text-red-400 px-1.5 ${t?.name ? "" : "ml-auto"}`}
                      >
                        &times;
                      </button>
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
