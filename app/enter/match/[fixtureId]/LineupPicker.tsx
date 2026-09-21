"use client";

import { useMemo, useState } from "react";

/**
 * Naming a side, for a recorder filling in an old match.
 *
 * Deliberately not the club portal's picker: that one is a light-themed
 * component built around a club's own squad and its approval state, and this
 * is a dark page where somebody is reconstructing a game from a team sheet
 * on paper. Search, tick, shirt number, bench — nothing else.
 */

export type SquadPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
};

export type NamedPlayer = {
  player_id: string;
  jersey_number: number | null;
  is_starter: boolean | null;
};

export function LineupPicker({
  squad,
  named,
}: {
  squad: SquadPlayer[];
  named: NamedPlayer[];
}) {
  const namedBy = useMemo(
    () => new Map(named.map((n) => [n.player_id, n])),
    [named]
  );

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(named.map((n) => n.player_id))
  );
  const [query, setQuery] = useState("");

  // Those already in the side first, so what is named reads at a glance.
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...squad]
      .filter((p) =>
        q
          ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        const an = picked.has(a.player_id) ? 0 : 1;
        const bn = picked.has(b.player_id) ? 0 : 1;
        if (an !== bn) return an - bn;
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      });
  }, [squad, query, picked]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a player"
          className="flex-1 min-w-0 bg-neutral-950 border border-white/15 rounded px-3 py-1.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-white/40"
        />
        <span className="text-xs text-slate-500 shrink-0 tabular-nums">
          {picked.size} named
        </span>
      </div>

      {squad.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          No active players on this club for that grade.
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded">
          {ordered.map((p) => {
            const on = picked.has(p.player_id);
            const was = namedBy.get(p.player_id);
            return (
              <li
                key={p.player_id}
                className={`flex items-center gap-2 px-2.5 py-2 ${
                  on ? "bg-white/5" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.player_id)}
                  className="shrink-0 accent-ghanaYellow-500"
                  aria-label={`Name ${p.first_name} ${p.last_name}`}
                />
                {/* Only a ticked player posts anything, so the server sees the
                    side as it stands rather than everyone at the club. */}
                {on && (
                  <input type="hidden" name={`picked:${p.player_id}`} value="on" />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">
                    {p.first_name} {p.last_name}
                  </span>
                  {p.position && (
                    <span className="block text-[11px] text-slate-500 truncate">
                      {p.position}
                    </span>
                  )}
                </span>

                {on && (
                  <>
                    <input
                      name={`jersey:${p.player_id}`}
                      defaultValue={
                        was?.jersey_number ?? p.jersey_number ?? ""
                      }
                      inputMode="numeric"
                      placeholder="#"
                      className="w-12 shrink-0 bg-neutral-950 border border-white/15 rounded px-1.5 py-1 text-sm text-center"
                      aria-label="Shirt number"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <input
                        type="checkbox"
                        name={`bench:${p.player_id}`}
                        defaultChecked={was ? was.is_starter === false : false}
                        className="accent-slate-400"
                      />
                      bench
                    </label>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
