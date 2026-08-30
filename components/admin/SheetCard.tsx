"use client";

import { useState } from "react";

/**
 * One club's named side, with enough of it visible to rule on.
 *
 * The names matter more than the count — the thing a federation checks is
 * whether anyone is on there who should not be — so the starters are shown
 * rather than hidden behind a link.
 */
export function SheetCard({
  sheet,
  names,
  approve,
  decline,
  reopen,
}: {
  sheet: any;
  names: any[];
  approve: (sheetId: string) => Promise<void>;
  decline: (sheetId: string, fd: FormData) => Promise<void>;
  reopen?: (sheetId: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const starters = names.filter((n) => n.is_starter !== false);
  const bench = names.filter((n) => n.is_starter === false);
  const shown = showAll ? names : starters;

  const label = (n: any) => {
    const p = Array.isArray(n.player) ? n.player[0] : n.player;
    const who = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Unnamed";
    return n.jersey_number != null ? `${n.jersey_number}. ${who}` : who;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-navy-900 truncate">{sheet.team?.name}</p>
          <p className="text-xs text-slate-500 truncate">
            {sheet.fixture?.home?.name} v {sheet.fixture?.away?.name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {[sheet.fixture?.scheduled_date, sheet.fixture?.competition?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="text-xs text-slate-500 shrink-0 text-right">
          {starters.length} starting
          {bench.length > 0 && (
            <span className="block text-slate-400">{bench.length} bench</span>
          )}
        </span>
      </div>

      {names.length === 0 ? (
        <p className="text-xs text-amber-700 mt-2">Nobody named on this sheet.</p>
      ) : (
        <>
          <ol className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-700">
            {shown.map((n, i) => (
              <li key={i} className="truncate">
                {label(n)}
                {n.is_starter === false && (
                  <span className="text-slate-400"> · bench</span>
                )}
              </li>
            ))}
          </ol>
          {bench.length > 0 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[11px] text-navy-600 hover:underline mt-1.5"
            >
              {showAll ? "Starters only" : `Show the bench (${bench.length})`}
            </button>
          )}
        </>
      )}

      {sheet.review_note && (
        <p className="text-xs text-red-700 mt-2">Sent back — {sheet.review_note}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3 justify-end">
        {reopen ? (
          <form action={reopen.bind(null, sheet.sheet_id)}>
            <button className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
              Reopen for the club
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={() => setAsking(!asking)}
              className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              Send back
            </button>
            <form action={approve.bind(null, sheet.sheet_id)}>
              <button
                disabled={names.length === 0}
                className="text-xs font-medium px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white"
              >
                Approve
              </button>
            </form>
          </>
        )}
      </div>

      {asking && (
        <form action={decline.bind(null, sheet.sheet_id)} className="flex gap-1.5 mt-2">
          <input
            name="reason"
            required
            placeholder="why? the club sees this"
            className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300"
          />
          <button className="text-xs font-medium px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white">
            Send back
          </button>
        </form>
      )}
    </div>
  );
}
