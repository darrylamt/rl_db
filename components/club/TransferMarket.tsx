"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { POSITIONS } from "@/lib/positions";
import { PLAYER_ATTRIBUTES } from "@/lib/attributes";

const FREE = "__free__";

type Player = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  photo_url: string | null;
  category: string | null;
  team_id: string | null;
  attr_strength?: number | null;
  attr_speed?: number | null;
  attr_iq?: number | null;
  attr_defense?: number | null;
  attr_ability?: number | null;
  attr_kicking?: number | null;
};

type Team = { team_id: string; name: string; logo_url: string | null };

const GRADE: Record<string, string> = {
  senior_men: "Men",
  senior_women: "Women",
  youth: "Youth",
};

function grade(category: string | null) {
  return GRADE[(category ?? "").toLowerCase().replace(/\s+/g, "_")] ?? "";
}

/**
 * Every other club's squad, and a way to ask about a player.
 *
 * Five hundred players is not a list anyone reads, so it opens on a club
 * rather than on everybody: you approach a club about a player, and that is
 * how the question is shaped. Search cuts across all of them for the times
 * you know the name but not where they are.
 */
export function TransferMarket({
  teams,
  players,
  openFor,
  contractLeft = {},
  request,
}: {
  teams: Team[];
  players: Player[];
  /** Players this club already has an open request for. */
  openFor: string[];
  /** player_id -> what is left to run, for those under contract. */
  contractLeft?: Record<string, string>;
  request: (fd: FormData) => Promise<void>;
}) {
  const freeAgents = useMemo(
    () => players.filter((p) => !p.team_id).length,
    [players],
  );
  const [club, setClub] = useState<string>(teams[0]?.team_id ?? FREE);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  // When set, the list is ordered by who is best at it rather than by
  // name — which is the question being asked: who is the best kicker
  // available, not who is available whose name starts with A.
  const [bestAt, setBestAt] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [kind, setKind] = useState<"transfer" | "loan">("transfer");

  const open = useMemo(() => new Set(openFor), [openFor]);
  const q = query.trim().toLowerCase();

  const shown = useMemo(() => {
    // A name search, or a position search, looks across every club: you are
    // asking who exists, not who exists at one club.
    const searching = !!q || !!position;

    let base = searching
      ? players
      : club === FREE
        ? players.filter((p) => !p.team_id)
        : players.filter((p) => p.team_id === club);

    if (q) {
      base = base.filter((p) =>
        `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(q),
      );
    }
    if (position) {
      base = base.filter((p) => (p.position ?? "") === position);
    }

    const sorted = [...base];
    if (bestAt) {
      // Unrated players go last rather than counting as zero, which would
      // read as "worst" when it means "nobody has looked".
      sorted.sort((a, b) => {
        const av = (a as any)[bestAt];
        const bv = (b as any)[bestAt];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv - av;
      });
    } else {
      sorted.sort((a, b) =>
        (a.last_name ?? "").localeCompare(b.last_name ?? ""),
      );
    }
    return sorted;
  }, [players, club, q, position, bestAt]);

  const teamName = (id: string | null) =>
    id ? (teams.find((t) => t.team_id === id)?.name ?? "") : "no club";

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search every club by player name"
        className="w-full px-3 py-2 rounded border border-slate-300 text-sm mb-3"
        aria-label="Search players at every club"
      />

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-3">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="px-3 py-2 rounded border border-slate-300 text-sm min-w-0"
          aria-label="Position"
        >
          <option value="">Any position</option>
          {POSITIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>

        <select
          value={bestAt}
          onChange={(e) => setBestAt(e.target.value)}
          className="px-3 py-2 rounded border border-slate-300 text-sm min-w-0"
          aria-label="Best at"
        >
          <option value="">Any strength</option>
          {PLAYER_ATTRIBUTES.map((a) => (
            <option key={a.key} value={a.key}>
              Best at {a.label.toLowerCase()}
            </option>
          ))}
        </select>

        {(position || bestAt) && (
          <button
            type="button"
            onClick={() => {
              setPosition("");
              setBestAt("");
            }}
            className="text-sm px-3 py-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Two to a row on a phone rather than a sideways scroll: a club is
          picked by its name and crest, and a row that scrolls cuts both in
          half at the edge. Names wrap rather than truncate — half a club name
          is not a club name. */}
      {!q && !position && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
          {/* A player nobody holds can be signed without asking anyone. */}
          {freeAgents > 0 && (
            <button
              onClick={() => setClub(FREE)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm border text-left transition ${
                club === FREE
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white border-emerald-200 text-emerald-800 hover:border-emerald-400"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                  club === FREE
                    ? "bg-white/20"
                    : "bg-emerald-100 text-emerald-800"
                }`}
                aria-hidden="true"
              >
                FA
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                Free agents
                <span className="block text-[11px] opacity-70">
                  {freeAgents} without a club
                </span>
              </span>
            </button>
          )}
          {teams.map((t) => (
            <button
              key={t.team_id}
              onClick={() => setClub(t.team_id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm border text-left transition ${
                club === t.team_id
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white border-slate-200 text-slate-700 hover:border-navy-300"
              }`}
            >
              <Avatar src={t.logo_url} name={t.name} size={24} />
              <span className="min-w-0 flex-1 leading-tight">{t.name}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
          {q
            ? `Nobody matches “${query}”.`
            : "No players listed for that club."}
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {shown.map((p) => {
            const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
            const already = open.has(p.player_id);
            return (
              <li key={p.player_id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar src={p.photo_url} name={name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy-900 truncate">
                      {name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[
                        !p.team_id
                          ? "Free agent"
                          : q
                            ? teamName(p.team_id)
                            : null,
                        p.position,
                        grade(p.category),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {bestAt && (
                      <p className="text-xs text-navy-700">
                        {PLAYER_ATTRIBUTES.find((a) => a.key === bestAt)?.label}
                        :{" "}
                        <span className="font-display tabular-nums">
                          {(p as any)[bestAt] ?? "not rated"}
                        </span>
                      </p>
                    )}
                    <p className="text-xs truncate">
                      {contractLeft[p.player_id] ? (
                        <span className="text-amber-800">
                          {contractLeft[p.player_id]} left on contract
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          Out of contract
                        </span>
                      )}
                    </p>
                  </div>
                  {already ? (
                    <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
                      Asked
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        setAsking(asking === p.player_id ? null : p.player_id)
                      }
                      className="text-xs font-medium px-3 py-1.5 rounded border border-navy-300 text-navy-800 hover:bg-navy-50 shrink-0"
                    >
                      Enquire
                    </button>
                  )}
                </div>

                {asking === p.player_id && (
                  <form
                    action={request}
                    className="mt-3 grid gap-2 bg-slate-50 border border-slate-200 rounded p-3"
                  >
                    <input type="hidden" name="player_id" value={p.player_id} />

                    <div className="flex gap-1 bg-white border border-slate-200 rounded p-1 w-fit">
                      {(["transfer", "loan"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          className={`px-3 py-1 rounded text-xs capitalize ${
                            kind === k
                              ? "bg-navy-900 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="kind" value={kind} />

                    {kind === "loan" && (
                      <label className="text-xs text-slate-600">
                        <span className="block mb-1">Loan runs until</span>
                        <input
                          type="date"
                          name="loan_until"
                          required
                          className="px-2 py-1.5 rounded border border-slate-300 text-sm"
                        />
                      </label>
                    )}

                    <textarea
                      name="message"
                      rows={2}
                      placeholder={`A note to ${teamName(p.team_id)} — optional`}
                      className="px-2 py-1.5 rounded border border-slate-300 text-sm"
                    />

                    <div className="flex gap-2">
                      <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-medium px-3 py-2 rounded">
                        {p.team_id
                          ? `Send to ${teamName(p.team_id)}`
                          : "Send to the federation"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAsking(null)}
                        className="text-xs px-3 py-2 rounded border border-slate-300 text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {p.team_id
                        ? "They accept or turn it down. Nothing moves until the federation signs it off after that."
                        : "Nobody holds this player, so there is no club to ask — it goes straight to the federation to sign off."}
                    </p>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
