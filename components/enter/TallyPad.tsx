"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";


type Player = {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  jersey_number: number | null;
};

/**
 * The counting stats, and how they are worth counting.
 *
 * These are the rows the live page's Stats tab has always had space for and
 * never had numbers in, because there was no way to enter them.
 */
const COUNTS: { type: string; label: string; short: string }[] = [
  { type: "tackle", label: "Tackle", short: "TKL" },
  { type: "missed_tackle", label: "Missed tackle", short: "MT" },
  { type: "tackle_break", label: "Tackle break", short: "TB" },
  { type: "line_break", label: "Line break", short: "LB" },
  { type: "offload", label: "Offload", short: "OFF" },
  { type: "turnover_won", label: "Turnover won", short: "TO" },
  { type: "completed_set", label: "Completed set", short: "SET" },
];

/**
 * Counting stats, one tap each.
 *
 * A match has a handful of tries and several hundred tackles. The event form
 * — pick a team, search a player, choose a type, submit — is right for the
 * first and hopeless for the second, which is why no tackle has ever been
 * recorded.
 *
 * So the stat is chosen once and stays chosen, and each tap on a player adds
 * one. The count on each name is what has been recorded for them so far, so
 * a recorder can see where they are without leaving the pad.
 */
export function TallyPad({
  fixtureId,
  fixture,
  players,
  namedIds,
  events,
  onRecorded,
}: {
  fixtureId: string;
  fixture: any;
  players: Player[];
  /** Who is on the team sheet — they lead the pad and the rest sit behind. */
  namedIds?: Set<string>;
  events: any[];
  onRecorded: () => void;
}) {
  const supabase = createClient();
  const [type, setType] = useState(COUNTS[0].type);
  const [side, setSide] = useState<"home" | "away">("home");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  const teamId = side === "home" ? fixture?.home_team_id : fixture?.away_team_id;
  const squad = useMemo(
    () =>
      players
        .filter((p) => p.team_id === teamId)
        .sort((a, b) => {
          // The named side first, then by shirt number within each group.
          const an = namedIds?.has(a.player_id) ? 0 : 1;
          const bn = namedIds?.has(b.player_id) ? 0 : 1;
          if (an !== bn) return an - bn;
          return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
        }),
    [players, teamId, namedIds]
  );

  // Where a team sheet exists, everyone behind it is a substitute nobody
  // named — worth separating rather than mixing into the same grid.
  const namedCount = squad.filter((p) => namedIds?.has(p.player_id)).length;

  /** How many of the chosen stat each player already has in this match. */
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.event_type !== type) continue;
      const id = e.player?.player_id;
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [events, type]);

  async function add(player: Player) {
    setBusy(player.player_id);
    setError(null);

    // A fresh id every tap: two taps here mean two tackles, which is the
    // opposite of the scoring form where a second tap means a slip.
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // No minute, deliberately. These happen faster than anyone can time
    // them, and a minute nobody actually observed would put them in the
    // timeline and misreport when a player did their work.
    const { error } = await supabase.from("match_events").insert({
      event_id: id,
      fixture_id: fixtureId,
      player_id: player.player_id,
      team_id: player.team_id,
      event_type: type,
      minute: null,
      half: null,
    });

    setBusy(null);
    if (error) { setError(error.message); return; }
    setLastId(id);
    onRecorded();
  }

  /** One tap too many — take the last one back. */
  async function undo() {
    if (!lastId) return;
    setBusy("undo");
    const { error } = await supabase
      .from("match_events")
      .delete()
      .eq("event_id", lastId);
    setBusy(null);
    if (error) { setError(error.message); return; }
    setLastId(null);
    onRecorded();
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-neutral-950 border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-ghanaYellow-500 font-display text-sm tracking-widest">
          COUNTS
        </h3>
        {lastId && (
          <button
            type="button"
            onClick={undo}
            disabled={busy !== null}
            className="text-xs px-2.5 py-1 rounded border border-white/20 text-slate-300 hover:border-white/50 disabled:opacity-50"
          >
            Undo last
          </button>
        )}
      </div>

      {/* Which stat is being counted */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {COUNTS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => setType(c.type)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium ${
              type === c.type
                ? "bg-ghanaYellow-500 text-black"
                : "border border-white/15 text-slate-300 hover:border-white/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Which side */}
      <div className="flex gap-1 bg-neutral-900 rounded-md p-1 mb-3">
        {(["home", "away"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`flex-1 px-3 py-1.5 rounded text-sm ${
              side === s ? "bg-white/10 text-white font-medium" : "text-slate-400"
            }`}
          >
            {s === "home" ? fixture?.home_team?.name ?? "Home" : fixture?.away_team?.name ?? "Away"}
          </button>
        ))}
      </div>

      {squad.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">
          No players on record for this side.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {squad.map((p) => {
            const n = counts.get(p.player_id) ?? 0;
            return (
              <button
                key={p.player_id}
                type="button"
                onClick={() => add(p)}
                disabled={busy !== null}
                className={`flex items-center gap-2 px-2.5 py-2.5 rounded border active:bg-neutral-800 disabled:opacity-50 text-left ${
                  namedIds && namedCount > 0 && !namedIds.has(p.player_id)
                    ? "bg-neutral-900/40 border-white/5 opacity-60 hover:border-white/20"
                    : "bg-neutral-900 border-white/10 hover:border-ghanaYellow-500/60"
                }`}
              >
                <span
                  className={`text-xs w-6 shrink-0 tabular-nums font-display ${
                    p.jersey_number != null ? "text-ghanaYellow-500" : "text-slate-600"
                  }`}
                >
                  {p.jersey_number ?? "—"}
                </span>
                <span className="text-xs text-white truncate flex-1">
                  {p.last_name || p.first_name}
                </span>
                {n > 0 && (
                  <span className="text-xs font-display tabular-nums text-ghanaYellow-500 shrink-0">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-500 mt-2">
        {total > 0
          ? `${total} ${COUNTS.find((c) => c.type === type)?.label.toLowerCase()}${
              total === 1 ? "" : "s"
            } recorded this match.`
          : "Tap a player to add one. These fill the Stats tab on the live page."}
        {" These are counts — they carry no minute, so they never clutter the timeline."}
      </p>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
