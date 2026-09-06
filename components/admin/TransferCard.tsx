"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";

const WORDS: Record<string, string> = {
  with_club: "Waiting on the club",
  rejected: "Turned down",
  with_player: "With the player",
  player_declined: "Player said no",
  with_federation: "To sign off",
  approved: "Done",
  declined: "Refused",
  withdrawn: "Withdrawn",
};

const TONE: Record<string, string> = {
  with_club: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  with_player: "bg-violet-100 text-violet-800",
  player_declined: "bg-red-100 text-red-800",
  with_federation: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  withdrawn: "bg-slate-100 text-slate-600",
};

/**
 * One move, with both clubs and what each of them said.
 *
 * The direction is the point — who is losing a player and who is gaining
 * one — so it reads as a line across the card rather than as two fields.
 */
export function TransferCard({
  request,
  approve,
  decline,
  readOnly,
  buyerBalance = null,
}: {
  request: any;
  approve: (requestId: string) => Promise<void>;
  decline: (requestId: string, fd: FormData) => Promise<void>;
  readOnly?: boolean;
  /** What the buying club holds. Null before the budgets migration is run. */
  buyerBalance?: number | null;
}) {
  const [asking, setAsking] = useState(false);
  const r = request;
  const player = Array.isArray(r.player) ? r.player[0] : r.player;
  const name = `${player?.first_name ?? ""} ${player?.last_name ?? ""}`.trim() || "Unnamed";

  // Between the clubs agreeing and this being signed off the player may have
  // moved some other way. Saying so up front beats an error on the button.
  const stale =
    r.status === "with_federation" &&
    player?.team_id &&
    r.from_team?.team_id &&
    player.team_id !== r.from_team.team_id;

  // The price agreed when the request was made, honoured at sign-off rather
  // than recalculated. Absent on requests made before there was a currency.
  const fee = typeof r.fee === "number" ? r.fee : null;
  const levy = typeof r.levy === "number" ? r.levy : 0;
  const total = fee === null ? null : fee + levy;
  const cannotAfford =
    total !== null && total > 0 && buyerBalance !== null && total > buyerBalance;
  const lx = (n: number) => `${Math.round(n).toLocaleString("en-GB")} LX`;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <Avatar src={player?.photo_url} name={name} size={44} />
          <div className="min-w-0">
            <p className="font-medium text-navy-900 break-words">{name}</p>
            <p className="text-xs text-slate-500">
              {r.kind === "loan" ? "Loan" : "Transfer"}
              {r.kind === "loan" && r.loan_until ? ` until ${r.loan_until}` : ""}
              {player?.position ? ` · ${player.position}` : ""}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
            TONE[r.status] ?? TONE.withdrawn
          }`}
        >
          {WORDS[r.status] ?? r.status}
        </span>
      </div>

      {/* Who loses, who gains */}
      <div className="flex items-center gap-2 mt-3 text-sm">
        <span className="flex items-center gap-1.5 min-w-0">
          <Avatar src={r.from_team?.logo_url} name={r.from_team?.name} size={18} />
          <span className="truncate text-slate-700">{r.from_team?.name ?? "—"}</span>
        </span>
        <span className="text-slate-400 shrink-0">&rarr;</span>
        <span className="flex items-center gap-1.5 min-w-0">
          <Avatar src={r.to_team?.logo_url} name={r.to_team?.name} size={18} />
          <span className="truncate font-medium text-navy-900">{r.to_team?.name ?? "—"}</span>
        </span>
      </div>

      {/* The bill. Signing off is what actually moves the LX, so it belongs
          on the button's own card rather than only on the finance page. */}
      {total !== null && total > 0 && (
        <div
          className={`mt-2 rounded border px-2.5 py-2 text-xs ${
            cannotAfford
              ? "bg-red-50 border-red-300 text-red-800"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          <p className="flex justify-between gap-3">
            <span>Fee to {r.from_team?.name ?? "their club"}</span>
            <span className="tabular-nums">{lx(fee ?? 0)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span>Levy to the federation</span>
            <span className="tabular-nums">{lx(levy)}</span>
          </p>
          {cannotAfford && (
            <p className="mt-1.5 leading-snug">
              {r.to_team?.name ?? "The buying club"} holds{" "}
              {lx(buyerBalance ?? 0)}. Signing this off leaves them{" "}
              {lx(total - (buyerBalance ?? 0))} overdrawn.
            </p>
          )}
        </div>
      )}

      {r.message && (
        <p className="text-xs text-slate-600 mt-2 italic break-words">“{r.message}”</p>
      )}
      {r.club_note && (
        <p className="text-xs text-slate-600 mt-1 break-words">
          {r.from_team?.name ?? "The club"} replied: {r.club_note}
        </p>
      )}
      {r.review_note && (
        <p className="text-xs text-red-700 mt-1 break-words">Refused — {r.review_note}</p>
      )}

      {stale && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
          This player has already left {r.from_team?.name}. The request is out
          of date — refuse it and let the clubs start again.
        </p>
      )}

      {!readOnly && r.status === "with_federation" && (
        <>
          <div className="flex flex-wrap gap-2 mt-3 justify-end">
            <button
              onClick={() => setAsking(!asking)}
              className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              Refuse
            </button>
            <form action={approve.bind(null, r.request_id)}>
              <button
                disabled={!!stale}
                className="text-xs font-medium px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white"
              >
                Sign it off
              </button>
            </form>
          </div>

          {asking && (
            <form action={decline.bind(null, r.request_id)} className="flex gap-1.5 mt-2">
              <input
                name="reason"
                required
                placeholder="why? both clubs see this"
                className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300"
              />
              <button className="text-xs font-medium px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white">
                Refuse
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
