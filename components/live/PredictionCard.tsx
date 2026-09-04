"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { castPrediction } from "@/app/live/actions";
import { dominantColour } from "@/lib/logoColour";

type Team = {
  team_id?: string;
  name: string | null;
  logo_url: string | null;
  /** Set by the federation where the crest reads wrong; wins when present. */
  brandColor?: string | null;
} | null;

export type PollMatch = {
  fixtureId: string;
  home: Team;
  away: Team;
  competition: string;
  kickoff: string;
  /** When voting shuts: kick-off, as an ISO instant. */
  closesAt: string | null;
  counts: { home: number; away: number };
};

/**
 * "Who will win?" — a poll, and nothing else.
 *
 * No likes, comments or share row: a fan taps a crest, sees where the
 * predictions are running, and that is the whole feature. A vote is tied to
 * a random id kept in this browser's localStorage rather than an account,
 * since there is no fan login here — soft protection against voting twice,
 * which is all a poll like this needs.
 *
 * A pick can be changed. The database upserts on (fixture, device) so
 * switching moves the vote rather than adding one, and somebody who taps the
 * wrong crest should not be stuck with it.
 */
/**
 * The club's colour: what the federation set, else what the crest says, else
 * the card's own. Resolved here rather than inside the bar so the ring around
 * the crest and the bar beneath it are the same colour.
 */
function useTeamColour(team: Team, fallback: string): string {
  const [found, setFound] = useState<string | null>(null);
  const set = team?.brandColor ?? null;

  useEffect(() => {
    if (set) return;
    let live = true;
    dominantColour(team?.logo_url).then((c) => {
      if (live) setFound(c);
    });
    return () => {
      live = false;
    };
  }, [team?.logo_url, set]);

  return set ?? found ?? fallback;
}

export function PredictionCard({ matches }: { matches: PollMatch[] }) {
  const [index, setIndex] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "home" | "away">>({});
  const [counts, setCounts] = useState<Record<string, { home: number; away: number }>>(
    () => Object.fromEntries(matches.map((m) => [m.fixtureId, m.counts]))
  );
  const [pending, setPending] = useState(false);

  const match = matches[index];

  useEffect(() => {
    try {
      let id = localStorage.getItem("rlfg_device_id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("rlfg_device_id", id);
      }
      setDeviceId(id);

      const found: Record<string, "home" | "away"> = {};
      for (const m of matches) {
        const stored = localStorage.getItem(`rlfg_predicted_${m.fixtureId}`);
        if (stored === "home" || stored === "away") found[m.fixtureId] = stored;
      }
      setVotes(found);
    } catch {
      // Private browsing or storage disabled — the poll still works, it just
      // will not remember a vote on the next visit.
    }
  }, [matches]);

  async function vote(choice: "home" | "away") {
    if (pending || !match || closed) return;
    const fixtureId = match.fixtureId;
    const previous = votes[fixtureId];
    if (previous === choice) return;

    setPending(true);
    setVotes((v) => ({ ...v, [fixtureId]: choice }));
    setCounts((c) => {
      const cur = c[fixtureId] ?? { home: 0, away: 0 };
      const next = { ...cur, [choice]: cur[choice] + 1 };
      // Switching moves the vote rather than adding a second one.
      if (previous) next[previous] = Math.max(0, next[previous] - 1);
      return { ...c, [fixtureId]: next };
    });
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

  // Checked on the clock rather than only at render, so a card left open on
  // a phone stops taking votes when the match actually kicks off.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const homeColour = useTeamColour(match?.home ?? null, "#6366f1");
  const awayColour = useTeamColour(match?.away ?? null, "#c026d3");

  if (!match) return null;

  const closesAt = match.closesAt ? Date.parse(match.closesAt) : null;
  const closed = closesAt != null && now >= closesAt;

  const mine = votes[match.fixtureId] ?? null;
  const tally = counts[match.fixtureId] ?? { home: 0, away: 0 };
  const total = tally.home + tally.away;
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">
            Rugby League Federation Ghana
          </p>
          <p className="text-[11px] text-violet-300/70 leading-tight truncate">
            {match.competition}
          </p>
        </div>

        {matches.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <Arrow
              dir="prev"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            />
            <span className="text-[11px] tabular-nums text-violet-300/70 w-8 text-center">
              {index + 1}/{matches.length}
            </span>
            <Arrow
              dir="next"
              disabled={index === matches.length - 1}
              onClick={() => setIndex((i) => Math.min(matches.length - 1, i + 1))}
            />
          </div>
        )}
      </div>

      <h2 className="font-display text-xl md:text-2xl leading-tight mb-5">
        Who will win {matches.length > 1 && index > 0 ? "this game" : "the next game"}?
      </h2>

      {/* The two sides */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-5">
        <Crest
          team={match.home}
          colour={homeColour}
          onClick={() => vote("home")}
          picked={mine === "home"}
          closed={closed}
        />

        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-lg text-white/90">VS</span>
          <span className="rounded-full bg-black/40 border border-white/10 px-3 py-1.5 text-center leading-tight">
            <span className="block text-[11px] text-white/80 whitespace-nowrap">
              {match.kickoff}
            </span>
          </span>
        </div>

        <Crest
          team={match.away}
          colour={awayColour}
          onClick={() => vote("away")}
          picked={mine === "away"}
          closed={closed}
        />
      </div>

      {/* Where the predictions are running */}
      <div className="space-y-2 rounded-2xl bg-black/30 border border-white/5 p-3">
        <Bar team={match.home} colour={homeColour} pct={pct(tally.home)} picked={mine === "home"} />
        <Bar team={match.away} colour={awayColour} pct={pct(tally.away)} picked={mine === "away"} />
      </div>

      <p className="text-[11px] text-violet-300/60 text-center mt-3">
        {closed
          ? `Predictions closed at kick-off · ${total} in total`
          : total === 0
          ? "No predictions yet — have the first say."
          : `${total} prediction${total === 1 ? "" : "s"}${
              mine ? " · tap the other crest to change your mind" : " · tap a crest to pick"
            }`}
      </p>
    </div>
  );
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous match" : "Next match"}
      className="w-7 h-7 rounded-full border border-white/15 bg-white/5 grid place-items-center text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition"
    >
      <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
        <path
          d={dir === "prev" ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"}
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Crest({
  team,
  colour,
  onClick,
  picked,
  closed,
}: {
  team: Team;
  colour: string;
  onClick: () => void;
  picked: boolean;
  closed: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={closed}
      className={`flex flex-col items-center gap-2 min-w-0 transition ${
        closed ? "cursor-default" : "hover:scale-[1.03]"
      } ${closed && !picked ? "opacity-60" : ""}`}
    >
      {/* The ring is the club's colour, the same one its bar is filled with,
          so the pick and the bar read as the same thing. */}
      <span
        className="rounded-full p-1 transition"
        style={{
          boxShadow: picked
            ? `0 0 0 3px ${colour}`
            : `0 0 0 1px rgba(255,255,255,0.15)`,
        }}
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
  colour,
  pct,
  picked,
}: {
  team: Team;
  colour: string;
  pct: number;
  picked: boolean;
}) {
  const base = colour;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-9 rounded-full bg-white/5 overflow-hidden">
        {/* Sheen sits on top as its own layer rather than being mixed into
            the colour — the club colour can arrive as hsl() or hex, and
            string-splicing an alpha onto either is how that breaks. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 overflow-hidden"
          style={{ width: `${Math.max(pct, pct > 0 ? 12 : 0)}%`, background: base }}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-1.5">
          <Avatar src={team?.logo_url} name={team?.name} size={24} contain />
          <span
            className={`text-xs tabular-nums font-semibold pr-2 drop-shadow ${
              picked ? "text-ghanaYellow-500" : "text-white"
            }`}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
