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
 *
 * The bars show from the start rather than after voting. Hiding them would
 * make the card look broken to somebody who has already voted from another
 * device, and the split is the interesting part either way.
 */
export function PredictionCard({
  fixtureId,
  home,
  away,
  competition,
  kickoff,
  initialCounts,
}: {
  fixtureId: string;
  home: Team;
  away: Team;
  competition: string;
  kickoff: string;
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
      // Cast anyway; it just won't be remembered as "already voted".
    }
    try {
      await castPrediction(fixtureId, deviceId ?? crypto.randomUUID(), choice);
    } catch {
      // The optimistic pick stands either way — nothing useful to tell a fan
      // about a poll write failing.
    }
    setPending(false);
  }

  const total = counts.home + counts.away;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950 via-purple-950 to-neutral-950 p-4 md:p-5 mb-6">
      {/* Who is asking */}
      <div className="flex items-center gap-2.5 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/federationlogo.png"
          alt=""
          className="w-9 h-9 rounded-full shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            Rugby League Federation Ghana
          </p>
          <p className="text-[11px] text-violet-300/70 leading-tight truncate">
            {competition}
          </p>
        </div>
      </div>

      <h2 className="font-display text-xl md:text-2xl leading-tight mb-5">
        Who will win the next game?
      </h2>

      {/* The two sides */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-5">
        <Crest team={home} onClick={() => vote("home")} picked={voted === "home"} locked={!!voted} />

        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-lg text-white/90">VS</span>
          <span className="rounded-full bg-black/40 border border-white/10 px-3 py-1.5 text-center leading-tight">
            <span className="block text-[11px] text-white/80 whitespace-nowrap">
              {kickoff}
            </span>
          </span>
        </div>

        <Crest team={away} onClick={() => vote("away")} picked={voted === "away"} locked={!!voted} />
      </div>

      {/* Where the predictions are running */}
      <div className="space-y-2 rounded-2xl bg-black/30 border border-white/5 p-3">
        <Bar
          team={home}
          pct={pct(counts.home)}
          picked={voted === "home"}
          tint="from-indigo-500 to-violet-500"
        />
        <Bar
          team={away}
          pct={pct(counts.away)}
          picked={voted === "away"}
          tint="from-fuchsia-600 to-violet-500"
        />
      </div>

      <p className="text-[11px] text-violet-300/60 text-center mt-3">
        {total === 0
          ? "No predictions yet — have the first say."
          : `${total} prediction${total === 1 ? "" : "s"}${
              voted ? "" : " · tap a crest to pick"
            }`}
      </p>
    </div>
  );
}

function Crest({
  team,
  onClick,
  picked,
  locked,
}: {
  team: Team;
  onClick: () => void;
  picked: boolean;
  locked: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`flex flex-col items-center gap-2 min-w-0 transition ${
        locked ? "cursor-default" : "hover:scale-[1.03]"
      } ${locked && !picked ? "opacity-60" : ""}`}
    >
      <span
        className={`rounded-full p-1 ${
          picked ? "ring-2 ring-ghanaYellow-500" : "ring-1 ring-white/15"
        }`}
      >
        <Avatar src={team?.logo_url} name={team?.name} size={72} contain />
      </span>
      <span className="text-xs md:text-sm font-medium text-center leading-tight line-clamp-2 w-full">
        {team?.name ?? "TBC"}
      </span>
    </button>
  );
}

function Bar({
  team,
  pct,
  picked,
  tint,
}: {
  team: Team;
  pct: number;
  picked: boolean;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-9 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tint} transition-all duration-500`}
          style={{ width: `${Math.max(pct, pct > 0 ? 12 : 0)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-1.5">
          <Avatar src={team?.logo_url} name={team?.name} size={24} contain />
          <span
            className={`text-xs tabular-nums font-semibold pr-2 ${
              picked ? "text-ghanaYellow-500" : "text-white/90"
            }`}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
