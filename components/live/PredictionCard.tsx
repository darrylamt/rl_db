"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { castPrediction } from "@/app/live/actions";

type Team = { team_id?: string; name: string | null; logo_url: string | null } | null;

/**
 * "Who will win the next game?" — a poll, and nothing else.
 *
 * No likes, comments or share row: a fan taps a crest, sees where the
 * predictions are running, and that is the whole feature. A vote is tied to
 * a random id kept in this browser's localStorage rather than an account,
 * since there is no fan login here — soft protection against voting twice,
 * which is all a poll like this needs.
 */
export function PredictionCard({
  fixtureId,
  home,
  away,
  subtitle,
  initialCounts,
}: {
  fixtureId: string;
  home: Team;
  away: Team;
  subtitle: string;
  initialCounts: { home: number; away: number };
}) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [voted, setVoted] = useState<"home" | "away" | null>(null);
  const [counts, setCounts] = useState(initialCounts);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      let id = localStorage.getItem("rlfg_device_id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("rlfg_device_id", id);
      }
      setDeviceId(id);

      const stored = localStorage.getItem(`rlfg_predicted_${fixtureId}`);
      if (stored === "home" || stored === "away") setVoted(stored);
    } catch {
      // Private browsing or storage disabled — the poll still works, it just
      // will not remember a vote on the next visit.
    }
  }, [fixtureId]);

  async function vote(choice: "home" | "away") {
    if (pending || voted) return;
    setPending(true);
    setVoted(choice);
    setCounts((c) => ({ ...c, [choice]: c[choice] + 1 }));
    try {
      localStorage.setItem(`rlfg_predicted_${fixtureId}`, choice);
    } catch {
      // Same as above — the vote still gets cast, it just won't be
      // remembered as "already voted" next time.
    }
    try {
      await castPrediction(
        fixtureId,
        deviceId ?? crypto.randomUUID(),
        choice
      );
    } catch {
      // The optimistic pick stands either way — nothing useful to tell a fan
      // about a poll write failing.
    }
    setPending(false);
  }

  const total = counts.home + counts.away;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 md:p-5 mb-6">
      <p className="font-display text-lg leading-tight">
        Who will win the next game?
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-4 truncate">
        {subtitle}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <PredictOption
          team={home}
          pct={voted ? pct(counts.home) : null}
          picked={voted === "home"}
          disabled={!!voted || pending}
          onClick={() => vote("home")}
        />
        <PredictOption
          team={away}
          pct={voted ? pct(counts.away) : null}
          picked={voted === "away"}
          disabled={!!voted || pending}
          onClick={() => vote("away")}
        />
      </div>

      {voted && (
        <p className="text-[11px] text-slate-500 text-center mt-3">
          {total} prediction{total === 1 ? "" : "s"} so far
        </p>
      )}
    </div>
  );
}

function PredictOption({
  team,
  pct,
  picked,
  disabled,
  onClick,
}: {
  team: Team;
  pct: number | null;
  picked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-xl border px-3 py-4 flex flex-col items-center gap-2 text-center transition ${
        picked
          ? "border-ghanaYellow-500 bg-ghanaYellow-500/10"
          : "border-white/10 bg-white/5 hover:border-white/25"
      } ${disabled && !picked ? "opacity-60" : ""}`}
    >
      {pct !== null && (
        <span
          className="absolute inset-y-0 left-0 bg-white/10"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      )}
      <span className="relative">
        <Avatar src={team?.logo_url} name={team?.name} size={40} contain />
      </span>
      <span className="relative text-sm font-medium truncate max-w-full">
        {team?.name ?? "TBC"}
      </span>
      {pct !== null && (
        <span className="relative font-display text-xl tabular-nums">
          {pct}%
        </span>
      )}
    </button>
  );
}
