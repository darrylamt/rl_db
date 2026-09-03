"use client";

import { useState } from "react";
import { POSITIONS } from "@/lib/positions";

/**
 * Main position, and the others a player can cover.
 *
 * The two are one control rather than two fields in different places: the
 * main position is what anything weighted by role reads, and whoever is
 * entering 500 players will fill the first box and never come back for a
 * second one further down the form.
 *
 * The main position disappears from the cover list as it is chosen, because
 * "can also cover prop" said of a prop is noise — the database rejects it and
 * the form should not offer it in the first place.
 */
export function PositionFields({
  position,
  secondary,
  hint,
}: {
  position?: string | null;
  secondary?: readonly string[] | null;
  hint?: string;
}) {
  const [main, setMain] = useState(position ?? "");
  const chosen = new Set(secondary ?? []);

  return (
    <div className="grid gap-3">
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">
          Main position
        </label>
        <select
          name="position"
          value={main}
          onChange={(e) => setMain(e.target.value)}
          className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-navy-900 focus:border-navy-700 focus:outline-none"
        >
          <option value="">— not set —</option>
          {POSITIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {hint ?? "Where they usually play. This is what their rating is weighted against."}
        </p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-600 mb-1">
          Can also cover
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 bg-slate-50 border border-slate-200 rounded p-3">
          {POSITIONS.filter((p) => p !== main).map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 text-sm text-navy-900 cursor-pointer"
            >
              <input
                type="checkbox"
                name="secondary_positions"
                value={p}
                defaultChecked={chosen.has(p)}
                className="h-4 w-4 rounded border-slate-400 text-navy-900 focus:ring-navy-700"
              />
              {p}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Optional. Used for squad depth and searching for cover — not for
          their rating.
        </p>
      </div>
    </div>
  );
}
