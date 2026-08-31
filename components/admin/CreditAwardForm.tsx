"use client";

import { useMemo, useState } from "react";
import type { CreditRule } from "@/lib/credits";

/**
 * Awarding by hand.
 *
 * Most of the regulations are things no database can see — dues paid, an AGM
 * held, a coach qualified — so this is the main way credits move rather than
 * an escape hatch. The value comes from the rule so nobody is typing 300 from
 * memory, but it can be overridden for the cases the sheet does not cover.
 */
export function CreditAwardForm({
  clubs,
  rules,
  season,
  award,
}: {
  clubs: any[];
  rules: CreditRule[];
  season: string;
  award: (fd: FormData) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const chosen = useMemo(() => rules.find((r) => r.code === code), [rules, code]);

  // Grouped the way the concept note groups them, so the list reads like the
  // regulations rather than like a database table.
  const areas = useMemo(() => {
    const m = new Map<string, CreditRule[]>();
    for (const r of rules) {
      if (!m.has(r.area)) m.set(r.area, []);
      m.get(r.area)!.push(r);
    }
    return Array.from(m);
  }, [rules]);

  return (
    <form
      action={award}
      className="bg-white border border-slate-200 rounded-lg p-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto_auto] items-end"
    >
      <div className="sm:col-span-4">
        <h2 className="font-display text-lg text-navy-900">Award or deduct</h2>
        <p className="text-xs text-slate-500">
          For everything the system cannot see for itself — dues, documents,
          AGMs, coaching courses, equipment failures.
        </p>
      </div>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Club
        </span>
        <select
          name="team_id"
          required
          defaultValue=""
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        >
          <option value="">— pick a club —</option>
          {clubs.map((c) => (
            <option key={c.team_id} value={c.team_id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Reason
        </span>
        <select
          name="code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        >
          <option value="">— pick a reason —</option>
          {areas.map(([area, list]) => (
            <optgroup key={area} label={area}>
              {list.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.amount > 0 ? "+" : ""}
                  {r.amount})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Credits
        </span>
        <input
          name="amount"
          type="number"
          key={code}
          defaultValue={chosen?.amount ?? ""}
          className="w-24 px-3 py-2 rounded border border-slate-300 text-sm tabular-nums"
        />
      </label>

      <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded">
        Record it
      </button>

      <input type="hidden" name="season" value={season} />

      <label className="text-sm sm:col-span-4">
        <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
          Note — the club sees this
        </span>
        <input
          name="note"
          placeholder="e.g. 2026 dues received 14 March"
          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
        />
      </label>

      {chosen?.season_cap != null && (
        <p className="sm:col-span-4 text-xs text-amber-800">
          Capped at {chosen.season_cap} a season.
        </p>
      )}
      {chosen?.requires_review && (
        <p className="sm:col-span-4 text-xs text-slate-500">
          The regulations mark this one for review, so the system never applies
          it on its own — recording it here is that decision.
        </p>
      )}
    </form>
  );
}
