"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { FormShell, Field, Input, Textarea } from "@/components/admin/FormShell";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Player {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
  position?: string | null;
}

interface Team {
  team_id: string;
  name: string;
}

type PlayerRef = { player_id: string; first_name: string; last_name: string };
type TeamRef = { team_id: string; name: string };

interface MatchEvent {
  event_id: string;
  event_type: string;
  minute?: number | null;
  half?: number | null;
  notes?: string | null;
  player?: PlayerRef | PlayerRef[] | null;
  team?: TeamRef | TeamRef[] | null;
}

interface LineupEntry {
  lineup_id: string;
  jersey_number?: number | null;
  position?: string | null;
  is_starter?: boolean | null;
  player?: PlayerRef | PlayerRef[] | null;
  team?: TeamRef | TeamRef[] | null;
}

interface PlayerRating {
  rating_id: string;
  player_id: string;
  team_id: string;
  rating: number;
  notes: string | null;
}

// Supabase returns joins as arrays; unwrap safely
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ─── Event config ────────────────────────────────────────────────────────────
// Event types are stored as lowercase slugs in the DB for consistency.
// Display labels are shown in the UI.

const EVENT_CATEGORIES = [
  {
    label: "Scoring",
    color: "emerald",
    events: [
      { value: "try", label: "Try" },
      { value: "conversion", label: "Conversion" },
      { value: "missed_conversion", label: "Missed Conversion" },
      { value: "penalty_goal", label: "Penalty Goal" },
      { value: "drop_goal", label: "Drop Goal" },
    ],
  },
  {
    label: "Discipline",
    color: "red",
    events: [
      { value: "yellow_card", label: "Yellow Card" },
      { value: "red_card", label: "Red Card" },
    ],
  },
  {
    label: "Attacking",
    color: "blue",
    events: [
      { value: "tackle_break", label: "Tackle Break" },
      { value: "offload", label: "Offload" },
      { value: "clean_break", label: "Clean Break" },
      { value: "metres_gained", label: "Metres Gained" },
    ],
  },
  {
    label: "Defending",
    color: "purple",
    events: [
      { value: "tackle", label: "Tackle" },
      { value: "missed_tackle", label: "Missed Tackle" },
      { value: "turnover_won", label: "Turnover Won" },
    ],
  },
  {
    label: "Completed Sets",
    color: "teal",
    events: [{ value: "completed_set", label: "Completed Set" }],
  },
];

// Map DB value → display label
const EVENT_LABEL: Record<string, string> = {};
for (const cat of EVENT_CATEGORIES) {
  for (const ev of cat.events) {
    EVENT_LABEL[ev.value] = ev.label;
  }
}

const ALL_EVENT_TYPES = EVENT_CATEGORIES.flatMap((c) => c.events);

function eventColor(type: string) {
  for (const cat of EVENT_CATEGORIES) {
    if (cat.events.some((e) => e.value === type)) return cat.color;
  }
  return "slate";
}

const COLOR_CLASSES: Record<string, { badge: string; dot: string }> = {
  emerald: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  red: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  blue: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  purple: { badge: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  teal: { badge: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  slate: { badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
};

// ─── Rating formula ──────────────────────────────────────────────────────────

const RATING_BASE = 6.0;
const RATING_WEIGHTS: Record<string, number> = {
  try:               1.5,
  conversion:        0.25,
  missed_conversion: -0.25,
  penalty_goal:      0.5,
  drop_goal:         0.75,
  yellow_card:       -1.5,
  red_card:          -3.0,
  tackle_break:      0.5,
  clean_break:       0.75,
  offload:           0.3,
  metres_gained:     0.2,
  tackle:            0.1,
  missed_tackle:     -0.3,
  turnover_won:      0.5,
  completed_set:     0.2,
};

// Stat labels shown in the rating row summary
const STAT_LABELS: { key: string; label: string; sign: "pos" | "neg" | "neutral" }[] = [
  { key: "try",               label: "Try",         sign: "pos"     },
  { key: "conversion",        label: "Conv",        sign: "pos"     },
  { key: "missed_conversion", label: "Miss. Conv",  sign: "neg"     },
  { key: "penalty_goal",      label: "PG",          sign: "pos"     },
  { key: "drop_goal",         label: "DG",          sign: "pos"     },
  { key: "clean_break",       label: "Line Break",  sign: "pos"     },
  { key: "tackle_break",      label: "Tkl Break",   sign: "pos"     },
  { key: "offload",           label: "Offload",     sign: "pos"     },
  { key: "tackle",            label: "Tackle",      sign: "neutral" },
  { key: "missed_tackle",     label: "Miss. Tkl",   sign: "neg"     },
  { key: "turnover_won",      label: "Turnover",    sign: "pos"     },
  { key: "completed_set",     label: "Comp. Set",   sign: "pos"     },
  { key: "metres_gained",     label: "Metres",      sign: "pos"     },
  { key: "yellow_card",       label: "Yellow",      sign: "neg"     },
  { key: "red_card",          label: "Red",         sign: "neg"     },
];

function calcAutoRating(playerEvents: MatchEvent[]): number {
  let r = RATING_BASE;
  for (const ev of playerEvents) r += RATING_WEIGHTS[ev.event_type] ?? 0;
  return Math.max(1, Math.min(10, Math.round(r * 10) / 10));
}

function ratingColor(r: number) {
  if (r >= 8)   return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (r >= 6.5) return "text-navy-700 bg-navy-50 border-navy-200";
  if (r >= 5)   return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

// ─── Player search combobox ──────────────────────────────────────────────────

function PlayerSearch({
  players,
  value,
  onChange,
  placeholder = "Search player…",
}: {
  players: Player[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = players.find((p) => p.player_id === value);
  const filtered = useMemo(() => {
    if (!query) return players.slice(0, 20);
    const q = query.toLowerCase();
    return players
      .filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          String(p.jersey_number ?? "").includes(q)
      )
      .slice(0, 20);
  }, [query, players]);

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
        placeholder={selected ? `${selected.first_name} ${selected.last_name}` : placeholder}
        value={open ? query : selected ? `${selected.first_name} ${selected.last_name}` : ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          <li
            className="px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 cursor-pointer"
            onMouseDown={() => { onChange(""); setQuery(""); setOpen(false); }}
          >
            — None —
          </li>
          {filtered.map((p) => (
            <li
              key={p.player_id}
              className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer flex items-center gap-2"
              onMouseDown={() => { onChange(p.player_id); setQuery(""); setOpen(false); }}
            >
              {p.jersey_number && (
                <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {p.jersey_number}
                </span>
              )}
              <span className="font-medium">{p.first_name} {p.last_name}</span>
              {p.position && <span className="text-slate-400 text-xs">{p.position}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Events Tab ─────────────────────────────────────────────────────────────

// Detect which half a minute falls in based on game format
function detectHalf(minute: number, is9s: boolean): number {
  const halfLen = is9s ? 20 : 40;
  if (minute <= halfLen) return 1;
  if (minute <= halfLen * 2) return 2;
  return 3;
}

function halfLabel(half: number): string {
  return half === 1 ? "1st Half" : half === 2 ? "2nd Half" : "Extra Time";
}

function EventsTab({
  fixtureId,
  events,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  competitionName,
  addEvent,
  deleteEvent,
}: {
  fixtureId: string;
  events: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  competitionName?: string;
  addEvent: (fd: FormData) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
}) {
  // Detect game format from competition name/type
  const is9s = /9s?/i.test(competitionName ?? "");

  const [teamId, setTeamId] = useState(homeTeam.team_id);
  const [playerId, setPlayerId] = useState("");
  const [eventType, setEventType] = useState(ALL_EVENT_TYPES[0].value);
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activePlayers = teamId === homeTeam.team_id ? homePlayers : awayPlayers;

  // Parse minute preview for display
  const parsedMinutes = useMemo(() => {
    if (!minutes.trim()) return [];
    return minutes
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }, [minutes]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.append("team_id", teamId);
    if (playerId) fd.append("player_id", playerId);
    fd.append("event_type", eventType);
    if (minutes.trim()) fd.append("minutes", minutes);
    fd.append("is9s", String(is9s));
    if (notes) fd.append("notes", notes);

    startTransition(async () => {
      try {
        await addEvent(fd);
        setPlayerId("");
        setMinutes("");
        setNotes("");
      } catch (err: any) {
        setError(err.message ?? "Failed to save event");
      }
    });
  }

  function handleDelete(eventId: string) {
    setDeletingId(eventId);
    startTransition(async () => {
      try {
        await deleteEvent(eventId);
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Add event form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Add Event</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Team */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setTeamId(homeTeam.team_id); setPlayerId(""); }}
              className={`py-2 px-3 rounded border text-sm font-medium transition-colors ${
                teamId === homeTeam.team_id
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {homeTeam.name}
            </button>
            <button
              type="button"
              onClick={() => { setTeamId(awayTeam.team_id); setPlayerId(""); }}
              className={`py-2 px-3 rounded border text-sm font-medium transition-colors ${
                teamId === awayTeam.team_id
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {awayTeam.name}
            </button>
          </div>

          {/* Player search */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
              Player <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <PlayerSearch
              players={activePlayers}
              value={playerId}
              onChange={setPlayerId}
            />
          </div>

          {/* Event type pills */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Event Type</label>
            <div className="space-y-2">
              {EVENT_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="text-xs text-slate-400 mb-1">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.events.map((ev) => {
                      const col = COLOR_CLASSES[cat.color];
                      const active = eventType === ev.value;
                      return (
                        <button
                          key={ev.value}
                          type="button"
                          onClick={() => setEventType(ev.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            active
                              ? `${col.badge} border-current ring-2 ring-offset-1 ring-current`
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {ev.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Minutes — comma-separated for bulk entry */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
              Minute(s)
              <span className="ml-1 text-slate-400 font-normal normal-case">
                — separate multiple with commas
              </span>
            </label>
            <input
              type="text"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder={`e.g. 5, 23, 37`}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
            {/* Preview halves */}
            {parsedMinutes.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {parsedMinutes.map((m, i) => {
                  const h = detectHalf(m, is9s);
                  return (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600">
                      <span className="font-semibold">{m}'</span>
                      <span className="text-slate-400">{halfLabel(h)}</span>
                    </span>
                  );
                })}
                {parsedMinutes.length > 1 && (
                  <span className="text-xs text-slate-400 self-center">
                    → {parsedMinutes.length} events will be created
                  </span>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Half is auto-detected · {is9s ? "9s format: H1 = 1–20, H2 = 21–40" : "13s format: H1 = 1–40, H2 = 41–80"}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note…"
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Add Event"}
          </button>
        </form>
      </div>

      {/* Events list */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Recorded Events</h3>
          <span className="text-xs text-slate-400">{events.length} events</span>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">No events recorded yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((ev) => {
              const color = eventColor(ev.event_type);
              const col = COLOR_CLASSES[color];
              const player = one(ev.player);
              const team = one(ev.team);
              // Display label: use mapped label or fallback to stored value
              const displayLabel = EVENT_LABEL[ev.event_type] ?? ev.event_type;
              return (
                <li key={ev.event_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  {/* Minute badge */}
                  <div className="flex-shrink-0 w-10 text-center">
                    {ev.minute ? (
                      <span className="text-sm font-bold text-navy-900">{ev.minute}'</span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>

                  {/* Event type badge */}
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${col.badge}`}>
                    {displayLabel}
                  </span>

                  {/* Player + team */}
                  <div className="flex-1 min-w-0">
                    {player && (
                      <p className="text-sm font-medium text-navy-900 truncate">
                        <Link
                          href={`/admin/players/${player.player_id}/view`}
                          className="hover:underline"
                        >
                          {player.first_name} {player.last_name}
                        </Link>
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      {team ? (
                        <Link
                          href={`/admin/teams/${team.team_id}/view`}
                          className="hover:underline"
                        >
                          {team.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {ev.half && ` · H${ev.half}`}
                      {ev.notes && ` · ${ev.notes}`}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(ev.event_id)}
                    disabled={deletingId === ev.event_id}
                    className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors text-lg leading-none disabled:opacity-40"
                    title="Delete event"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Lineup Tab ──────────────────────────────────────────────────────────────

function LineupTab({
  fixtureId,
  lineup,
  homeTeam,
  awayTeam,
}: {
  fixtureId: string;
  lineup: LineupEntry[];
  homeTeam: Team;
  awayTeam: Team;
}) {
  const home = lineup.filter((l) => one(l.team)?.team_id === homeTeam.team_id);
  const away = lineup.filter((l) => one(l.team)?.team_id === awayTeam.team_id);

  function PlayerList({ entries, label }: { entries: LineupEntry[]; label: string }) {
    const starters = entries.filter((e) => e.is_starter);
    const subs = entries.filter((e) => !e.is_starter);
    return (
      <div>
        <h4 className="text-sm font-semibold text-navy-900 mb-2">{label}</h4>
        {starters.length === 0 && subs.length === 0 ? (
          <p className="text-sm text-slate-400">No lineup recorded.</p>
        ) : (
          <div className="space-y-3">
            {starters.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Starters</p>
                <ul className="space-y-1">
                  {starters.map((e) => {
                    const player = one(e.player);
                    return (
                      <li key={e.lineup_id} className="flex items-center gap-2 text-sm">
                        {e.jersey_number && (
                          <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {e.jersey_number}
                          </span>
                        )}
                        <span className="font-medium text-navy-900">
                          {player ? (
                            <Link href={`/admin/players/${player.player_id}/view`} className="hover:underline">
                              {player.first_name} {player.last_name}
                            </Link>
                          ) : "—"}
                        </span>
                        {e.position && <span className="text-slate-400 text-xs">{e.position}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {subs.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Substitutes</p>
                <ul className="space-y-1">
                  {subs.map((e) => {
                    const player = one(e.player);
                    return (
                      <li key={e.lineup_id} className="flex items-center gap-2 text-sm text-slate-600">
                        {e.jersey_number && (
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {e.jersey_number}
                          </span>
                        )}
                        <span>
                          {player ? (
                            <Link href={`/admin/players/${player.player_id}/view`} className="hover:underline">
                              {player.first_name} {player.last_name}
                            </Link>
                          ) : "—"}
                        </span>
                        {e.position && <span className="text-slate-400 text-xs">{e.position}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Match Lineup</h3>
        <Link
          href={`/admin/fixtures/${fixtureId}/lineup`}
          className="text-xs text-navy-700 hover:underline"
        >
          Edit lineup →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <PlayerList entries={home} label={homeTeam.name} />
        <PlayerList entries={away} label={awayTeam.name} />
      </div>
    </div>
  );
}

// ─── Score Tab ───────────────────────────────────────────────────────────────
// Rugby League scoring: Try=4, Conversion=2, Penalty=2, Drop Goal=1

function calcScore(tries: number, conv: number, pens: number, drops: number): number {
  return tries * 4 + conv * 2 + pens * 2 + drops;
}

function ScoreTab({
  fixture,
  result,
  upsertResult,
}: {
  fixture: any;
  result: any;
  upsertResult: (fd: FormData) => Promise<void>;
}) {
  const r = result ?? {};
  const homeName = one(fixture.home)?.name ?? "Home";
  const awayName = one(fixture.away)?.name ?? "Away";

  const [homeTries, setHomeTries] = useState(r.home_tries ?? 0);
  const [homeConv, setHomeConv] = useState(r.home_conversions ?? 0);
  const [homePens, setHomePens] = useState(r.home_penalties ?? 0);
  const [homeDrops, setHomeDrops] = useState(r.home_drop_goals ?? 0);
  const [awayTries, setAwayTries] = useState(r.away_tries ?? 0);
  const [awayConv, setAwayConv] = useState(r.away_conversions ?? 0);
  const [awayPens, setAwayPens] = useState(r.away_penalties ?? 0);
  const [awayDrops, setAwayDrops] = useState(r.away_drop_goals ?? 0);

  const homeScore = calcScore(
    Number(homeTries), Number(homeConv), Number(homePens), Number(homeDrops)
  );
  const awayScore = calcScore(
    Number(awayTries), Number(awayConv), Number(awayPens), Number(awayDrops)
  );

  function numInput(
    value: number | string,
    setter: (v: number) => void,
    name: string,
  ) {
    return (
      <input
        type="number"
        name={name}
        min={0}
        value={value}
        onChange={(e) => setter(Number(e.target.value) || 0)}
        className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
      />
    );
  }

  return (
    <form
      action={async (fd: FormData) => {
        // Inject calculated scores so the server action gets the right values
        fd.set("home_score", String(homeScore));
        fd.set("away_score", String(awayScore));
        await upsertResult(fd);
      }}
      className="space-y-5"
    >
      {/* Score display */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-center gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{homeName}</p>
          <p className="text-4xl font-display font-bold text-navy-900 tabular-nums">{homeScore}</p>
        </div>
        <span className="text-2xl text-slate-300 font-light">–</span>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{awayName}</p>
          <p className="text-4xl font-display font-bold text-navy-900 tabular-nums">{awayScore}</p>
        </div>
      </div>

      {/* Hidden score fields (submitted via form action override above) */}
      <input type="hidden" name="home_score" value={homeScore} />
      <input type="hidden" name="away_score" value={awayScore} />

      {/* Home breakdown */}
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-medium">{homeName}</p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Tries">{numInput(homeTries, setHomeTries, "home_tries")}</Field>
          <Field label="Conv.">{numInput(homeConv, setHomeConv, "home_conversions")}</Field>
          <Field label="Pens.">{numInput(homePens, setHomePens, "home_penalties")}</Field>
          <Field label="Drop">{numInput(homeDrops, setHomeDrops, "home_drop_goals")}</Field>
        </div>
      </div>

      {/* Away breakdown */}
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-medium">{awayName}</p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Tries">{numInput(awayTries, setAwayTries, "away_tries")}</Field>
          <Field label="Conv.">{numInput(awayConv, setAwayConv, "away_conversions")}</Field>
          <Field label="Pens.">{numInput(awayPens, setAwayPens, "away_penalties")}</Field>
          <Field label="Drop">{numInput(awayDrops, setAwayDrops, "away_drop_goals")}</Field>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Attendance">
          <Input name="attendance" type="number" min={0} defaultValue={r.attendance ?? ""} />
        </Field>
        <Field label="Recorded by">
          <Input name="recorded_by" defaultValue={r.recorded_by ?? ""} placeholder="Your name" />
        </Field>
      </div>
      <Field label="Notes"><Textarea name="notes" defaultValue={r.notes ?? ""} /></Field>

      <button
        type="submit"
        className="w-full py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 transition-colors"
      >
        {result ? "Update result" : "Record result"}
      </button>
    </form>
  );
}

// ─── Ratings Tab ─────────────────────────────────────────────────────────────

function RatingsTab({
  lineup,
  events,
  ratings,
  homeTeam,
  awayTeam,
  saveRatings,
  deleteRating,
}: {
  lineup: LineupEntry[];
  events: MatchEvent[];
  ratings: PlayerRating[];
  homeTeam: Team;
  awayTeam: Team;
  saveRatings: (rows: { player_id: string; team_id: string; rating: number; notes: string | null }[]) => Promise<void>;
  deleteRating: (ratingId: string, fixtureId: string) => Promise<void>;
}) {
  // Build list of unique players from lineup (prefer lineup; fall back to events)
  const playerMap = new Map<string, { player: PlayerRef; team_id: string; jersey: number | null; position: string | null; is_starter: boolean }>();

  for (const entry of lineup) {
    const p = one(entry.player);
    const t = one(entry.team);
    if (p && t) {
      playerMap.set(p.player_id, {
        player: p,
        team_id: t.team_id,
        jersey: entry.jersey_number ?? null,
        position: entry.position ?? null,
        is_starter: entry.is_starter ?? false,
      });
    }
  }
  // Also include players who have events but aren't in the lineup
  for (const ev of events) {
    const p = one(ev.player);
    const t = one(ev.team);
    if (p && t && !playerMap.has(p.player_id)) {
      playerMap.set(p.player_id, { player: p, team_id: t.team_id, jersey: null, position: null, is_starter: false });
    }
  }

  const allPlayers = Array.from(playerMap.values());
  const homePlayers = allPlayers.filter((p) => p.team_id === homeTeam.team_id);
  const awayPlayers = allPlayers.filter((p) => p.team_id === awayTeam.team_id);

  // savedRating map: player_id → rating row
  const savedMap = new Map(ratings.map((r) => [r.player_id, r]));

  // Local editable values: player_id → { rating, notes }
  type RatingEdit = { rating: string; notes: string };
  const initEdits = (): Map<string, RatingEdit> => {
    const m = new Map<string, RatingEdit>();
    for (const p of allPlayers) {
      const saved = savedMap.get(p.player.player_id);
      const auto  = calcAutoRating(events.filter((e) => one(e.player)?.player_id === p.player.player_id));
      m.set(p.player.player_id, {
        rating: saved ? String(saved.rating) : String(auto),
        notes:  saved?.notes ?? "",
      });
    }
    return m;
  };

  const [edits, setEdits] = useState<Map<string, RatingEdit>>(initEdits);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function setEdit(playerId: string, patch: Partial<RatingEdit>) {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(playerId, { ...prev.get(playerId)!, ...patch });
      return next;
    });
  }

  function autoFillAll() {
    setEdits((prev) => {
      const next = new Map(prev);
      for (const p of allPlayers) {
        const auto = calcAutoRating(events.filter((e) => one(e.player)?.player_id === p.player.player_id));
        const cur  = next.get(p.player.player_id)!;
        next.set(p.player.player_id, { ...cur, rating: String(auto) });
      }
      return next;
    });
  }

  function handleSave() {
    setError(""); setSuccess("");
    const rows: { player_id: string; team_id: string; rating: number; notes: string | null }[] = [];
    for (const p of allPlayers) {
      const e = edits.get(p.player.player_id);
      if (!e) continue;
      const r = parseFloat(e.rating);
      if (isNaN(r) || r < 1 || r > 10) {
        setError(`Invalid rating for ${p.player.first_name} ${p.player.last_name} — must be 1–10`);
        return;
      }
      rows.push({ player_id: p.player.player_id, team_id: p.team_id, rating: r, notes: e.notes.trim() || null });
    }
    startTransition(async () => {
      try {
        await saveRatings(rows);
        setSuccess(`${rows.length} player rating${rows.length !== 1 ? "s" : ""} saved.`);
      } catch (err: any) {
        setError(err.message ?? "Failed to save ratings");
      }
    });
  }

  if (allPlayers.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
        No players in the lineup yet. Add the lineup first, then come back to rate.
      </div>
    );
  }

  function TeamSection({ players, label }: { players: typeof homePlayers; label: string }) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-navy-900">{label}</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {players.map(({ player, jersey, position, is_starter }) => {
            const playerEvents = events.filter((e) => one(e.player)?.player_id === player.player_id);
            const autoRating   = calcAutoRating(playerEvents);
            const edit         = edits.get(player.player_id) ?? { rating: String(autoRating), notes: "" };
            const rVal         = parseFloat(edit.rating);
            const rDisplay     = isNaN(rVal) ? null : rVal;
            const statCounts   = STAT_LABELS
              .map((s) => ({ ...s, count: playerEvents.filter((e) => e.event_type === s.key).length }))
              .filter((s) => s.count > 0);

            return (
              <div key={player.player_id} className="px-4 py-3 flex flex-wrap items-start gap-3">
                {/* Jersey + name */}
                <div className="flex items-center gap-2 min-w-[10rem] flex-1">
                  {jersey != null && (
                    <span className="w-7 h-7 rounded-full bg-navy-100 text-navy-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {jersey}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-navy-900">
                      {player.first_name} {player.last_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {position ?? "—"}{!is_starter && " · Sub"}
                    </p>
                  </div>
                </div>

                {/* Stat badges */}
                <div className="flex flex-wrap gap-1 flex-1 items-center">
                  {statCounts.length === 0 ? (
                    <span className="text-xs text-slate-300">No events recorded</span>
                  ) : statCounts.map((s) => (
                    <span
                      key={s.key}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                        s.sign === "pos"     ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        s.sign === "neg"     ? "bg-red-50 text-red-700 border-red-200" :
                                               "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {s.count > 1 && <span>{s.count}×</span>}
                      {s.label}
                    </span>
                  ))}
                </div>

                {/* Auto-rating hint + editable rating */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    Auto: <span className="font-medium text-slate-500">{autoRating.toFixed(1)}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={edit.rating}
                      onChange={(e) => setEdit(player.player_id, { rating: e.target.value })}
                      className="w-16 px-2 py-1 rounded border border-slate-300 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                    {rDisplay !== null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ratingColor(rDisplay)}`}>
                        {rDisplay.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={edit.notes}
                    onChange={(e) => setEdit(player.player_id, { notes: e.target.value })}
                    placeholder="Note…"
                    className="w-28 px-2 py-1 rounded border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-navy-500 text-slate-600 placeholder:text-slate-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Rate each player 1–10 based on their performance.{" "}
            <span className="text-slate-400">Ratings are auto-calculated from events but can be overridden.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={autoFillAll}
          className="text-xs text-navy-700 hover:underline font-medium"
        >
          ↺ Auto-fill all from stats
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded">{success}</div>
      )}

      <TeamSection players={homePlayers} label={homeTeam.name} />
      <TeamSection players={awayPlayers} label={awayTeam.name} />

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full py-2.5 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Saving…" : `Save All Ratings (${allPlayers.length} players)`}
      </button>

      {/* Rating legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1">
        <span className="font-medium text-slate-600">Guide:</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">8–10 Outstanding</span>
        <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-200">6.5–7.9 Good</span>
        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">5–6.4 Average</span>
        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">1–4.9 Poor</span>
      </div>
    </div>
  );
}

// ─── Main tabs shell ─────────────────────────────────────────────────────────

const TABS = ["Score", "Events", "Lineup", "Ratings"] as const;
type Tab = typeof TABS[number];

export function ResultTabs({
  fixtureId,
  fixture,
  result,
  events,
  lineup,
  ratings,
  homePlayers,
  awayPlayers,
  upsertResult,
  addEvent,
  deleteEvent,
  saveRatings,
  deleteRating,
}: {
  fixtureId: string;
  fixture: any;
  result: any;
  events: MatchEvent[];
  lineup: LineupEntry[];
  ratings: PlayerRating[];
  homePlayers: Player[];
  awayPlayers: Player[];
  upsertResult: (fd: FormData) => Promise<void>;
  addEvent: (fd: FormData) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  saveRatings: (rows: { player_id: string; team_id: string; rating: number; notes: string | null }[]) => Promise<void>;
  deleteRating: (ratingId: string, fixtureId: string) => Promise<void>;
})
 {
  const [activeTab, setActiveTab] = useState<Tab>("Score");

  const homeTeam: Team = one(fixture.home) as Team;
  const awayTeam: Team = one(fixture.away) as Team;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/results" className="text-xs text-slate-500 hover:underline mb-2 inline-block">
          ← Results
        </Link>
        <h1 className="text-xl font-bold text-navy-900">
          <Link href={`/admin/teams/${homeTeam?.team_id}/view`} className="hover:underline">
            {homeTeam?.name ?? "?"}
          </Link>{" "}
          <span className="text-slate-400 font-normal">vs</span>{" "}
          <Link href={`/admin/teams/${awayTeam?.team_id}/view`} className="hover:underline">
            {awayTeam?.name ?? "?"}
          </Link>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {fixture.competition?.name && `${fixture.competition.name} · `}
          {fixture.scheduled_date
            ? new Date(fixture.scheduled_date).toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
              })
            : "Date unknown"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-navy-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
            {tab === "Events" && events.length > 0 && (
              <span className="ml-1.5 text-xs bg-navy-100 text-navy-700 px-1.5 py-0.5 rounded-full">
                {events.length}
              </span>
            )}
            {tab === "Ratings" && ratings.length > 0 && (
              <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                {ratings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Score" && (
        <ScoreTab fixture={fixture} result={result} upsertResult={upsertResult} />
      )}
      {activeTab === "Events" && (
        <EventsTab
          fixtureId={fixtureId}
          events={events}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          competitionName={fixture.competition?.name ?? fixture.competition?.[0]?.name ?? ""}
          addEvent={addEvent}
          deleteEvent={deleteEvent}
        />
      )}
      {activeTab === "Lineup" && (
        <LineupTab fixtureId={fixtureId} lineup={lineup} homeTeam={homeTeam} awayTeam={awayTeam} />
      )}
      {activeTab === "Ratings" && (
        <RatingsTab
          lineup={lineup}
          events={events}
          ratings={ratings}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          saveRatings={saveRatings}
          deleteRating={deleteRating}
        />
      )}
    </div>
  );
}
