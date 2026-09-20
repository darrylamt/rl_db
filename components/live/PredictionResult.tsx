"use client";

import { useEffect, useState } from "react";

/**
 * What the crowd called, kept on screen after the whistle.
 *
 * The voting card only ever appeared on the home page and only for matches
 * nobody had seen yet, so the moment a game kicked off the prediction
 * vanished — which is exactly when it becomes worth looking at. This is the
 * read-only half: no voting, just the split, what you picked, and once there
 * is a score, whether either of you got it right.
 *
 * The viewer's own pick comes from the same localStorage key the voting card
 * writes, so a vote cast on the home page is recognised here without an
 * account or a round trip.
 */

export type Counts = { home: number; away: number };

export function PredictionResult({
  fixtureId,
  homeName,
  awayName,
  counts,
  result,
  compact = false,
}: {
  fixtureId: string;
  homeName: string;
  awayName: string;
  counts: Counts;
  /** The final score, when there is one. */
  result?: { home: number; away: number } | null;
  /** Thin version for a match card in a list. */
  compact?: boolean;
}) {
  const [mine, setMine] = useState<"home" | "away" | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`rlfg_predicted_${fixtureId}`);
      if (stored === "home" || stored === "away") setMine(stored);
    } catch {
      // Storage blocked. The split still shows; it just cannot say what you
      // picked, which is the part that needs the browser to remember.
    }
  }, [fixtureId]);

  const total = counts.home + counts.away;
  if (total === 0) return null;

  const homePct = Math.round((counts.home / total) * 100);
  const awayPct = 100 - homePct;

  const favourite: "home" | "away" | null =
    counts.home > counts.away
      ? "home"
      : counts.away > counts.home
        ? "away"
        : null;

  const winner: "home" | "away" | "draw" | null = result
    ? result.home > result.away
      ? "home"
      : result.away > result.home
        ? "away"
        : "draw"
    : null;

  const nameOf = (side: "home" | "away") =>
    side === "home" ? homeName : awayName;

  let verdict: { text: string; tone: string } | null = null;
  if (winner) {
    if (winner === "draw") {
      verdict = { text: "It finished level", tone: "text-slate-400" };
    } else if (favourite === null) {
      verdict = {
        text: `Split down the middle — ${nameOf(winner)} won it`,
        tone: "text-slate-400",
      };
    } else if (favourite === winner) {
      verdict = {
        text: `The crowd called it — ${nameOf(winner)}`,
        tone: "text-emerald-400",
      };
    } else {
      verdict = {
        text: `Upset — the crowd had ${nameOf(favourite)}`,
        tone: "text-ghanaYellow-500",
      };
    }
  }

  const yours =
    mine && winner
      ? winner === "draw"
        ? { text: "You picked a winner; it was a draw", tone: "text-slate-400" }
        : mine === winner
          ? { text: `You were right — you had ${nameOf(mine)}`, tone: "text-emerald-400" }
          : { text: `You had ${nameOf(mine)}`, tone: "text-red-400" }
      : mine
        ? { text: `You picked ${nameOf(mine)}`, tone: "text-slate-300" }
        : null;

  return (
    <div className={compact ? "mt-2.5" : "mt-0"}>
      {!compact && (
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
          What the crowd called
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] tabular-nums">
        <span
          className={
            favourite === "home" ? "text-ghanaYellow-500" : "text-slate-400"
          }
        >
          {homePct}%
        </span>

        <span className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-white/10">
          <span
            className="bg-ghanaYellow-500/80"
            style={{ width: `${homePct}%` }}
          />
          <span className="bg-sky-400/70" style={{ width: `${awayPct}%` }} />
        </span>

        <span
          className={favourite === "away" ? "text-sky-400" : "text-slate-400"}
        >
          {awayPct}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
        <span className="text-[11px] text-slate-500">
          {total} {total === 1 ? "vote" : "votes"}
        </span>
        {verdict && (
          <span className={`text-[11px] ${verdict.tone}`}>· {verdict.text}</span>
        )}
        {yours && (
          <span className={`text-[11px] ${yours.tone}`}>· {yours.text}</span>
        )}
      </div>
    </div>
  );
}
