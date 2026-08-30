"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";

const FREE = "__free__";

type Player = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  photo_url: string | null;
  category: string | null;
  team_id: string | null;
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
  request,
}: {
  teams: Team[];
  players: Player[];
  /** Players this club already has an open request for. */
  openFor: string[];
  request: (fd: FormData) => Promise<void>;
}) {
  const freeAgents = useMemo(
    () => players.filter((p) => !p.team_id).length,
    [players]
  );
  const [club, setClub] = useState<string>(teams[0]?.team_id ?? FREE);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [kind, setKind] = useState<"transfer" | "loan">("transfer");

  const open = useMemo(() => new Set(openFor), [openFor]);
  const q = query.trim().toLowerCase();

  const shown = useMemo(() => {
    const base = q
      ? players.filter((p) =>
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(q)
        )
      : club === FREE
      ? players.filter((p) => !p.team_id)
      : players.filter((p) => p.team_id === club);
    return [...base].sort((a, b) =>
      (a.last_name ?? "").localeCompare(b.last_name ?? "")
    );
  }, [players, club, q]);

  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.team_id === id)?.name ?? "" : "no club";

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

      {!q && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
          {/* A player nobody holds can be signed without asking anyone. */}
          {freeAgents > 0 && (
            <button
              onClick={() => setClub(FREE)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap border ${
                club === FREE
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white border-emerald-200 text-emerald-800 hover:border-emerald-400"
              }`}
            >
              Free agents
              <span className="text-[10px] opacity-80">{freeAgents}</span>
            </button>
          )}
          {teams.map((t) => (
            <button
              key={t.team_id}
              onClick={() => setClub(t.team_id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap border ${
                club === t.team_id
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white border-slate-200 text-slate-700 hover:border-navy-300"
              }`}
            >
              <Avatar src={t.logo_url} name={t.name} size={20} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
          {q ? `Nobody matches “${query}”.` : "No players listed for that club."}
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
                    <p className="text-sm font-medium text-navy-900 truncate">{name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[
                        !p.team_id ? "Free agent" : q ? teamName(p.team_id) : null,
                        p.position,
                        grade(p.category),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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
                  <form action={request} className="mt-3 grid gap-2 bg-slate-50 border border-slate-200 rounded p-3">
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
                        {p.team_id ? `Send to ${teamName(p.team_id)}` : "Send to the federation"}
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
