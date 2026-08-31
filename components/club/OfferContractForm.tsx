"use client";

import { useMemo, useState } from "react";
import { lengthProblem, monthsBetween, describeLength, daysUntil, describeDays } from "@/lib/contracts";

/**
 * Offering terms.
 *
 * The length is shown back as it is typed — "1 year 6 months" — because
 * two dates do not read as a duration, and the rule the club has to stay
 * inside is expressed in months.
 */
export function OfferContractForm({
  players,
  offer,
}: {
  players: any[];
  offer: (fd: FormData) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [playerId, setPlayerId] = useState("");
  const [starts, setStarts] = useState(today);
  const [ends, setEnds] = useState("");

  const chosen = players.find((p) => p.player_id === playerId);
  const renewing = chosen?.renewal ?? null;

  // New terms follow the old ones rather than sitting on top of them, so
  // picking somebody mid-contract moves the start to the day after it ends.
  const dayAfter = (d: string) => {
    const x = new Date(`${d}T00:00:00`);
    x.setDate(x.getDate() + 1);
    return x.toISOString().slice(0, 10);
  };
  const earliest = renewing ? dayAfter(renewing.ends_on) : today;

  const problem = useMemo(
    () => (starts && ends ? lengthProblem(starts, ends) : null),
    [starts, ends]
  );
  const length = useMemo(
    () => (starts && ends && !problem ? describeLength(monthsBetween(starts, ends)) : null),
    [starts, ends, problem]
  );

  /** The common lengths, so nobody counts months on their fingers. */
  const preset = (months: number) => {
    const d = new Date(`${starts || earliest}T00:00:00`);
    d.setMonth(d.getMonth() + months);
    setEnds(d.toISOString().slice(0, 10));
  };

  return (
    <form action={offer} className="bg-white border border-slate-200 rounded-lg p-4 grid gap-3">
      <div>
        <h2 className="font-display text-lg text-navy-900">Offer a contract</h2>
        <p className="text-xs text-slate-500">
          Six months to two years. Players with nothing running, and anyone
          whose contract is inside its last month.
        </p>
      </div>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Player
        </span>
        <select
          name="player_id"
          required
          value={playerId}
          onChange={(e) => {
            setPlayerId(e.target.value);
            const p = players.find((x) => x.player_id === e.target.value);
            setStarts(p?.renewal ? dayAfter(p.renewal.ends_on) : today);
            setEnds("");
          }}
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        >
          <option value="">— pick a player —</option>
          {players.map((p) => (
            <option key={p.player_id} value={p.player_id}>
              {`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()}
              {p.position ? ` — ${p.position}` : ""}
              {p.renewal
                ? ` (re-sign — ends ${describeDays(daysUntil(p.renewal.ends_on))})`
                : ""}
            </option>
          ))}
        </select>
        {players.length === 0 && (
          <span className="block text-xs text-amber-700 mt-1">
            Nobody to offer terms to. Everyone is either signed with more than
            a month left, or already has an offer waiting.
          </span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Starts
          </span>
          <input
            type="date"
            name="starts_on"
            required
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            Ends
          </span>
          <input
            type="date"
            name="ends_on"
            required
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
        </label>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[6, 12, 18, 24].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => preset(m)}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:border-navy-400"
          >
            {describeLength(m)}
          </button>
        ))}
      </div>

      {renewing && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Re-signing. Their current terms run to {renewing.ends_on}, so these
          start the day after — a new contract follows the old one rather than
          replacing it.
        </p>
      )}
      {problem && <p className="text-xs text-red-700">{problem}</p>}
      {length && (
        <p className="text-xs text-emerald-800">
          {length} — inside the rules.
        </p>
      )}

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Terms — the player sees this
        </span>
        <textarea
          name="terms"
          rows={2}
          placeholder="Anything the player should know before accepting"
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        />
      </label>

      <div>
        <button
          disabled={!!problem}
          className="bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2.5 rounded"
        >
          Send the offer
        </button>
      </div>
    </form>
  );
}
