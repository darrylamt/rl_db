"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface LineupEntry {
  lineup_id: string;
  jersey_number?: number | null;
  position?: string | null;
  is_starter?: boolean | null;
  player?: Player | Player[] | null;
  team?: Team | Team[] | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const POSITIONS = [
  "Full Back", "Wing", "Centre", "Stand Off", "Half Back",
  "Prop", "Hooker", "Second Row", "Loose Forward",
  "Interchange", "Other",
];

// ─── Player search combobox ───────────────────────────────────────────────────

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
    <div className="relative">
      <input
        type="text"
        className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
        placeholder={placeholder}
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
              {p.jersey_number != null && (
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

// ─── Add player form ──────────────────────────────────────────────────────────

function AddPlayerForm({
  fixtureId,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  addToLineup,
}: {
  fixtureId: string;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  addToLineup: (fd: FormData) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState(homeTeam.team_id);
  const [playerId, setPlayerId] = useState("");
  const [jersey, setJersey] = useState("");
  const [position, setPosition] = useState("");
  const [isStarter, setIsStarter] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const activePlayers = teamId === homeTeam.team_id ? homePlayers : awayPlayers;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerId) { setError("Please select a player"); return; }
    setError("");
    const fd = new FormData();
    fd.append("fixture_id", fixtureId);
    fd.append("team_id", teamId);
    fd.append("player_id", playerId);
    if (jersey) fd.append("jersey_number", jersey);
    if (position) fd.append("position", position);
    fd.append("is_starter", String(isStarter));

    startTransition(async () => {
      try {
        await addToLineup(fd);
        setPlayerId("");
        setJersey("");
        setPosition("");
      } catch (err: any) {
        setError(err.message ?? "Failed to add player");
      }
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Add Player</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}

        {/* Team toggle */}
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
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Player</label>
          <PlayerSearch
            players={activePlayers}
            value={playerId}
            onChange={setPlayerId}
          />
        </div>

        {/* Jersey + Position */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Jersey #</label>
            <input
              type="number"
              min={1}
              max={99}
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              <option value="">— Select —</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Starter / Sub toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsStarter(true)}
            className={`flex-1 py-1.5 rounded border text-sm font-medium transition-colors ${
              isStarter
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
            }`}
          >
            Starter
          </button>
          <button
            type="button"
            onClick={() => setIsStarter(false)}
            className={`flex-1 py-1.5 rounded border text-sm font-medium transition-colors ${
              !isStarter
                ? "bg-slate-600 text-white border-slate-600"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
            }`}
          >
            Substitute
          </button>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Adding…" : "Add to Lineup"}
        </button>
      </form>
    </div>
  );
}

// ─── Lineup list ──────────────────────────────────────────────────────────────

function LineupList({
  entries,
  teamName,
  removeFromLineup,
}: {
  entries: LineupEntry[];
  teamName: string;
  removeFromLineup: (id: string) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const starters = entries.filter((e) => e.is_starter);
  const subs = entries.filter((e) => !e.is_starter);

  function handleRemove(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      try { await removeFromLineup(id); }
      finally { setDeletingId(null); }
    });
  }

  function PlayerRow({ e }: { e: LineupEntry }) {
    const player = one(e.player);
    return (
      <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
        <span className="w-7 h-7 rounded-full bg-navy-100 text-navy-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {e.jersey_number ?? "—"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900">
            {player?.first_name} {player?.last_name}
          </p>
          {e.position && <p className="text-xs text-slate-400">{e.position}</p>}
        </div>
        <button
          onClick={() => handleRemove(e.lineup_id)}
          disabled={deletingId === e.lineup_id}
          className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none disabled:opacity-40"
          title="Remove"
        >
          ×
        </button>
      </li>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-navy-900">{teamName}</h4>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">No players added yet.</p>
      ) : (
        <>
          {starters.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100">
                <span className="text-xs uppercase tracking-wider text-slate-400">Starters</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {starters.map((e) => <PlayerRow key={e.lineup_id} e={e} />)}
              </ul>
            </>
          )}
          {subs.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100">
                <span className="text-xs uppercase tracking-wider text-slate-400">Substitutes</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {subs.map((e) => <PlayerRow key={e.lineup_id} e={e} />)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LineupEditor({
  fixtureId,
  fixture,
  homeTeam,
  awayTeam,
  lineup,
  homePlayers,
  awayPlayers,
  addToLineup,
  removeFromLineup,
}: {
  fixtureId: string;
  fixture: any;
  homeTeam: Team;
  awayTeam: Team;
  lineup: LineupEntry[];
  homePlayers: Player[];
  awayPlayers: Player[];
  addToLineup: (fd: FormData) => Promise<void>;
  removeFromLineup: (id: string) => Promise<void>;
}) {
  const homeEntries = lineup.filter((l) => one(l.team)?.team_id === homeTeam.team_id);
  const awayEntries = lineup.filter((l) => one(l.team)?.team_id === awayTeam.team_id);

  const date = fixture.scheduled_date
    ? new Date(fixture.scheduled_date).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "Date unknown";

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/admin/results/${fixtureId}`} className="text-xs text-slate-500 hover:underline mb-2 inline-block">
          ← Back to result
        </Link>
        <h1 className="text-xl font-bold text-navy-900">
          {homeTeam.name} <span className="text-slate-400 font-normal">vs</span> {awayTeam.name}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {fixture.competition?.name && `${Array.isArray(fixture.competition) ? fixture.competition[0]?.name : fixture.competition?.name} · `}
          {date} · Lineup
        </p>
      </div>

      <div className="space-y-6">
        {/* Add form */}
        <AddPlayerForm
          fixtureId={fixtureId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          addToLineup={addToLineup}
        />

        {/* Lineup lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LineupList
            entries={homeEntries}
            teamName={homeTeam.name}
            removeFromLineup={removeFromLineup}
          />
          <LineupList
            entries={awayEntries}
            teamName={awayTeam.name}
            removeFromLineup={removeFromLineup}
          />
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-400 text-center">
          {lineup.length} player{lineup.length !== 1 ? "s" : ""} in lineup ·{" "}
          {lineup.filter((l) => l.is_starter).length} starters ·{" "}
          {lineup.filter((l) => !l.is_starter).length} subs
        </p>
      </div>
    </div>
  );
}