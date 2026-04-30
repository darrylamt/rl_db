"use client";

import { useState, useTransition } from "react";
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

// ─── Per-player row state ─────────────────────────────────────────────────────

interface RowState {
  jersey: string;
  position: string;
}

// ─── Team Lineup Editor ───────────────────────────────────────────────────────

function TeamLineupEditor({
  fixtureId,
  team,
  players,
  lineup,
  addToLineup,
  removeFromLineup,
}: {
  fixtureId: string;
  team: Team;
  players: Player[];
  lineup: LineupEntry[];
  addToLineup: (fd: FormData) => Promise<void>;
  removeFromLineup: (id: string) => Promise<void>;
}) {
  // Build map: player_id → lineup entry
  const lineupMap = new Map<string, LineupEntry>();
  for (const entry of lineup) {
    const p = one(entry.player);
    if (p) lineupMap.set(p.player_id, entry);
  }

  // Local per-player state for jersey & position inputs
  const [rowState, setRowState] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const p of players) {
      const entry = lineupMap.get(p.player_id);
      init[p.player_id] = {
        jersey: String(entry?.jersey_number ?? p.jersey_number ?? ""),
        position: entry?.position ?? p.position ?? "",
      };
    }
    return init;
  });

  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function updateRow(playerId: string, patch: Partial<RowState>) {
    setRowState((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], ...patch },
    }));
  }

  function setRole(player: Player, role: "starter" | "sub" | "none") {
    const entry = lineupMap.get(player.player_id);
    const state = rowState[player.player_id] ?? { jersey: "", position: "" };

    if (role === "none") {
      if (!entry) return;
      setLoadingId(player.player_id);
      startTransition(async () => {
        try { await removeFromLineup(entry.lineup_id); }
        finally { setLoadingId(null); }
      });
    } else {
      setLoadingId(player.player_id);
      startTransition(async () => {
        try {
          const fd = new FormData();
          fd.append("fixture_id", fixtureId);
          fd.append("team_id", team.team_id);
          fd.append("player_id", player.player_id);
          if (state.jersey) fd.append("jersey_number", state.jersey);
          if (state.position) fd.append("position", state.position);
          fd.append("is_starter", String(role === "starter"));
          await addToLineup(fd);
        } finally {
          setLoadingId(null);
        }
      });
    }
  }

  const starterCount = players.filter(
    (p) => lineupMap.get(p.player_id)?.is_starter === true,
  ).length;
  const subCount = players.filter(
    (p) => lineupMap.get(p.player_id)?.is_starter === false,
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-navy-900">{team.name}</h4>
        <span className="text-xs text-slate-400">
          {starterCount} starters · {subCount} subs
        </span>
      </div>

      {players.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">
          No active players registered for this team.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  Jersey #
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((player) => {
                const entry = lineupMap.get(player.player_id);
                const role = !entry
                  ? "none"
                  : entry.is_starter
                    ? "starter"
                    : "sub";
                const state = rowState[player.player_id] ?? {
                  jersey: "",
                  position: "",
                };
                const isLoading = loadingId === player.player_id;

                return (
                  <tr
                    key={player.player_id}
                    className={
                      role === "starter"
                        ? "bg-emerald-50/40"
                        : role === "sub"
                          ? "bg-blue-50/20"
                          : "hover:bg-slate-50/60"
                    }
                  >
                    {/* Player name */}
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/players/${player.player_id}`}
                        className="font-medium text-navy-900 hover:underline"
                      >
                        {player.first_name} {player.last_name}
                      </Link>
                    </td>

                    {/* Jersey # */}
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={state.jersey}
                        onChange={(e) =>
                          updateRow(player.player_id, { jersey: e.target.value })
                        }
                        className="w-16 px-2 py-1 rounded border border-slate-300 text-sm text-center focus:outline-none focus:ring-1 focus:ring-navy-500"
                        placeholder="—"
                      />
                    </td>

                    {/* Position */}
                    <td className="px-2 py-2.5">
                      <select
                        value={state.position}
                        onChange={(e) =>
                          updateRow(player.player_id, { position: e.target.value })
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      >
                        <option value="">— Position —</option>
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Role buttons */}
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          disabled={isLoading || isPending}
                          onClick={() => setRole(player, "starter")}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${
                            role === "starter"
                              ? "bg-emerald-700 text-white border-emerald-700"
                              : "bg-white text-slate-600 border-slate-300 hover:border-emerald-500 hover:text-emerald-700"
                          }`}
                        >
                          Starter
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || isPending}
                          onClick={() => setRole(player, "sub")}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${
                            role === "sub"
                              ? "bg-slate-600 text-white border-slate-600"
                              : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
                          }`}
                        >
                          Sub
                        </button>
                        {role !== "none" && (
                          <button
                            type="button"
                            disabled={isLoading || isPending}
                            onClick={() => setRole(player, "none")}
                            className="px-2 py-1 rounded text-xs border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
                            title="Remove from lineup"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");

  const homeLineup = lineup.filter(
    (l) => one(l.team)?.team_id === homeTeam.team_id,
  );
  const awayLineup = lineup.filter(
    (l) => one(l.team)?.team_id === awayTeam.team_id,
  );

  const date = fixture.scheduled_date
    ? new Date(fixture.scheduled_date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Date unknown";

  const compName = Array.isArray(fixture.competition)
    ? fixture.competition[0]?.name
    : fixture.competition?.name;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/admin/results/${fixtureId}`}
          className="text-xs text-slate-500 hover:underline mb-2 inline-block"
        >
          ← Back to result
        </Link>
        <h1 className="text-xl font-bold text-navy-900">
          <Link
            href={`/admin/teams/${homeTeam.team_id}/view`}
            className="hover:underline"
          >
            {homeTeam.name}
          </Link>{" "}
          <span className="text-slate-400 font-normal">vs</span>{" "}
          <Link
            href={`/admin/teams/${awayTeam.team_id}/view`}
            className="hover:underline"
          >
            {awayTeam.name}
          </Link>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {compName && `${compName} · `}
          {date} · Lineup
        </p>
      </div>

      {/* Team tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTeam("home")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTeam === "home"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {homeTeam.name}
        </button>
        <button
          onClick={() => setActiveTeam("away")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTeam === "away"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {awayTeam.name}
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Set jersey number and position, then click <strong>Starter</strong> or{" "}
        <strong>Sub</strong> to add a player to the lineup.
      </p>

      {activeTeam === "home" ? (
        <TeamLineupEditor
          fixtureId={fixtureId}
          team={homeTeam}
          players={homePlayers}
          lineup={homeLineup}
          addToLineup={addToLineup}
          removeFromLineup={removeFromLineup}
        />
      ) : (
        <TeamLineupEditor
          fixtureId={fixtureId}
          team={awayTeam}
          players={awayPlayers}
          lineup={awayLineup}
          addToLineup={addToLineup}
          removeFromLineup={removeFromLineup}
        />
      )}

      <p className="text-xs text-slate-400 text-center mt-4">
        {lineup.length} player{lineup.length !== 1 ? "s" : ""} in lineup ·{" "}
        {lineup.filter((l) => l.is_starter).length} starters ·{" "}
        {lineup.filter((l) => !l.is_starter).length} subs
      </p>
    </div>
  );
}
