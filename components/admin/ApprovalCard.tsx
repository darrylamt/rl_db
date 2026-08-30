"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";

/**
 * One club submission, with enough of the player to decide on.
 *
 * Approving is one press. Declining asks for a reason first — the club is
 * shown it, and "declined" with no explanation only produces a phone call
 * the federation then has to answer anyway.
 */
export function ApprovalCard({
  player,
  approve,
  decline,
  reopen,
}: {
  player: any;
  approve: (playerId: string) => Promise<void>;
  decline: (playerId: string, fd: FormData) => Promise<void>;
  reopen?: (playerId: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);

  const name = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  const age = player.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(player.date_of_birth).getTime()) / 31557600000
      )
    : null;

  const facts = [
    player.position,
    player.jersey_number != null ? `#${player.jersey_number}` : null,
    age != null ? `${age}` : null,
    player.nationality,
    player.height_cm ? `${player.height_cm}cm` : null,
    player.weight_kg ? `${player.weight_kg}kg` : null,
  ].filter(Boolean);

  // What the club has not filled in is what the federation most often sends
  // one back for, so it is worth saying plainly rather than leaving them to
  // notice the gaps.
  const missing = [
    !player.position && "position",
    !player.date_of_birth && "date of birth",
    !player.photo_url && "photo",
  ].filter(Boolean) as string[];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex gap-3">
        <Avatar src={player.photo_url} name={name} size={56} rounded="md" />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900 truncate">{name || "Unnamed"}</p>
          <p className="text-xs text-slate-500 truncate">
            {player.team?.name ?? "No club"}
          </p>
          {facts.length > 0 && (
            <p className="text-xs text-slate-600 mt-1">{facts.join(" · ")}</p>
          )}
          {missing.length > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              Missing {missing.join(", ")}
            </p>
          )}
          {player.submitted_at && (
            <p className="text-[11px] text-slate-400 mt-1">
              Submitted {String(player.submitted_at).slice(0, 10)}
            </p>
          )}
          {player.review_note && (
            <p className="text-xs text-red-700 mt-1">
              Declined — {player.review_note}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 justify-end">
        {reopen ? (
          <form action={reopen.bind(null, player.player_id)}>
            <button className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
              Put back in the queue
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={() => setAsking(!asking)}
              className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              Decline
            </button>
            <form action={approve.bind(null, player.player_id)}>
              <button className="text-xs font-medium px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white">
                Approve
              </button>
            </form>
          </>
        )}
      </div>

      {asking && (
        <form
          action={decline.bind(null, player.player_id)}
          className="flex gap-1.5 mt-2"
        >
          <input
            name="reason"
            required
            placeholder="why? the club sees this"
            className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300"
          />
          <button className="text-xs font-medium px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white">
            Decline
          </button>
        </form>
      )}
    </div>
  );
}
