"use client";

import { useMemo, useState } from "react";
import { POSITIONS } from "@/lib/positions";

type Player = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
};

type Named = {
  player_id: string;
  jersey_number: number | null;
  position: string | null;
  is_starter: boolean | null;
};

/**
 * Picking the side, on a phone.
 *
 * Two things the first version got wrong. The name shared one row with a
 * shirt box, a position menu and a bench tick, so on a phone it was squeezed
 * to a single letter — exactly the thing you need to read. And a squad of
 * forty had to be scrolled to find anyone.
 *
 * So the name gets a line of its own until there is room for more, and there
 * is a search box.
 *
 * Filtered-out players stay mounted and are hidden, never unmounted. Saving
 * replaces the whole sheet, so a player who is ticked but scrolled out of
 * view would otherwise be dropped from the side by a search that had nothing
 * to do with them.
 */
export function TeamSheetPicker({
  squad,
  named,
  locked,
}: {
  squad: Player[];
  named: Named[];
  locked: boolean;
}) {
  const [query, setQuery] = useState("");

  const namedBy = useMemo(
    () => new Map(named.map((n) => [n.player_id, n])),
    [named]
  );

  // The named side first, so who is already in reads at a glance.
  const ordered = useMemo(
    () =>
      [...squad].sort((a, b) => {
        const an = namedBy.has(a.player_id) ? 0 : 1;
        const bn = namedBy.has(b.player_id) ? 0 : 1;
        if (an !== bn) return an - bn;
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      }),
    [squad, namedBy]
  );

  const q = query.trim().toLowerCase();
  const matches = (p: Player) => {
    if (!q) return true;
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      (p.position ?? "").toLowerCase().includes(q) ||
      String(p.jersey_number ?? "").includes(q)
    );
  };

  const shown = ordered.filter(matches).length;
  const pickedCount = namedBy.size;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, position or number"
          className="flex-1 min-w-0 px-3 py-2 rounded border border-slate-300 text-sm"
          aria-label="Search your squad"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {pickedCount} named
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
        {ordered.map((p) => {
          const on = namedBy.get(p.player_id);
          const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed";
          return (
            <div
              key={p.player_id}
              hidden={!matches(p)}
              className="px-3 py-2.5 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 items-center"
            >
              <input
                type="checkbox"
                name={`picked:${p.player_id}`}
                defaultChecked={!!on}
                disabled={locked}
                className="w-4 h-4 shrink-0"
                id={`pick-${p.player_id}`}
              />

              <label
                htmlFor={`pick-${p.player_id}`}
                className="min-w-0 cursor-pointer"
              >
                <span className="block font-medium text-navy-900 text-sm truncate">
                  {full}
                </span>
                {p.position && (
                  <span className="block text-xs text-slate-500 truncate">
                    {p.position}
                  </span>
                )}
              </label>

              {/* Its own row on a phone, alongside the name once there is room */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 justify-start sm:justify-end">
                <input
                  type="number"
                  name={`jersey:${p.player_id}`}
                  min={1}
                  defaultValue={on?.jersey_number ?? p.jersey_number ?? ""}
                  placeholder="#"
                  disabled={locked}
                  className="w-14 px-2 py-1.5 rounded border border-slate-300 text-sm"
                  aria-label={`Shirt number for ${full}`}
                />
                <select
                  name={`position:${p.player_id}`}
                  defaultValue={on?.position ?? p.position ?? ""}
                  disabled={locked}
                  className="flex-1 sm:flex-none sm:w-36 min-w-0 px-2 py-1.5 rounded border border-slate-300 text-sm"
                  aria-label={`Position for ${full}`}
                >
                  <option value="">— position —</option>
                  {POSITIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                  <input
                    type="checkbox"
                    name={`bench:${p.player_id}`}
                    defaultChecked={on ? on.is_starter === false : false}
                    disabled={locked}
                    className="w-3.5 h-3.5"
                  />
                  Bench
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {q && shown === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">
          Nobody in your squad matches “{query}”.
        </p>
      )}
    </div>
  );
}
