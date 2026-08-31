import { requirePlayer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { remaining, describeLength, monthsBetween, type Contract } from "@/lib/contracts";
import { answerBid, requestMove, withdrawMoveRequest } from "./actions";

export const dynamic = "force-dynamic";

const ASK_WORDS: Record<string, string> = {
  pending: "Waiting on your club",
  accepted: "Your club is willing",
  rejected: "Your club said no",
  withdrawn: "You withdrew it",
};

export default async function PlayerTransfersPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  const [{ data: contracts }, { data: bids, error }, { data: asks }, { data: history }] =
    await Promise.all([
      supabase
        .from("contracts")
        .select(
          "contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at, ended_note, team:team_id(name, logo_url)"
        )
        .eq("player_id", playerId)
        .order("offered_at", { ascending: false }),
      supabase
        .from("transfer_requests")
        .select(
          "request_id, kind, loan_until, status, message, club_note, review_note, requested_at, from_team:from_team_id(name, logo_url), to_team:to_team_id(name, logo_url)"
        )
        .eq("player_id", playerId)
        .order("requested_at", { ascending: false }),
      supabase
        .from("player_transfer_requests")
        .select("request_id, status, reason, club_note, created_at, team:team_id(name)")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("player_history")
        .select("history_id, season, role, joined_date, left_date, notes, team:team_id(name, logo_url)")
        .eq("player_id", playerId)
        .order("season", { ascending: false }),
    ]);

  const notMigrated = !!error && /transfer_requests/.test(error.message);

  const live = ((contracts ?? []) as any[]).find((c) => c.status === "accepted") ?? null;
  const left = remaining(live as Contract);
  const liveClub = live ? (Array.isArray(live.team) ? live.team[0] : live.team)?.name : null;

  const all = (bids ?? []) as any[];
  const waitingOnMe = all.filter((b) => b.status === "with_player");
  const otherBids = all.filter((b) => b.status !== "with_player");

  const requests = (asks ?? []) as any[];
  const openAsk = requests.find((r) => r.status === "pending") ?? null;

  const spells = (history ?? []) as any[];

  return (
    <div className="grid gap-6">
      {searchParams?.error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm px-3 py-2.5 rounded">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-200 text-sm px-3 py-2.5 rounded">
          {searchParams.note}
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl font-bold">Transfers</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          A club can only sign you if your club agrees and you agree. Nobody
          moves you without being asked.
        </p>
      </div>

      {/* Contract and value */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Your contract
          </p>
          <p className="font-display text-2xl mt-1 leading-tight">
            {left ? left.label : "None"}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {left
              ? `with ${liveClub}, ending ${left.endsOn}`
              : "you are out of contract"}
          </p>
        </div>
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Your value</p>
          <p className="font-display text-2xl mt-1 leading-tight text-slate-600">
            Not set yet
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            The federation is still working out how this is calculated.
          </p>
        </div>
      </div>

      {notMigrated ? (
        <div className="bg-amber-900/25 border border-amber-700 text-amber-200 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/player_in_the_transfer.sql</code> to
          turn this on.
        </div>
      ) : (
        <>
          {/* Waiting on you */}
          {waitingOnMe.length > 0 && (
            <section>
              <h2 className="font-display text-xl mb-3">
                {waitingOnMe.length === 1
                  ? "A club wants to sign you"
                  : "Clubs want to sign you"}
              </h2>
              <div className="grid gap-3">
                {waitingOnMe.map((b) => (
                  <div
                    key={b.request_id}
                    className="bg-neutral-900 border-2 border-ghanaYellow-500/60 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={b.to_team?.logo_url} name={b.to_team?.name} size={32} />
                      <div className="min-w-0">
                        <p className="font-display text-lg leading-tight">
                          {b.to_team?.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.kind === "loan" ? "Loan" : "Permanent transfer"}
                          {b.kind === "loan" && b.loan_until ? ` until ${b.loan_until}` : ""}
                          {b.from_team?.name ? ` · from ${b.from_team.name}` : ""}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-emerald-300 mt-2">
                      {b.from_team?.name ?? "Your club"} has agreed. It is your
                      decision now.
                    </p>
                    {b.message && (
                      <p className="text-sm text-slate-300 mt-2 italic break-words">
                        “{b.message}”
                      </p>
                    )}
                    {b.club_note && (
                      <p className="text-xs text-slate-400 mt-1 break-words">
                        Your club said: {b.club_note}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      <form action={answerBid.bind(null, b.request_id, true)}>
                        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded">
                          I want to go
                        </button>
                      </form>
                      <form
                        action={answerBid.bind(null, b.request_id, false)}
                        className="flex gap-1.5 flex-1 min-w-[13rem]"
                      >
                        <input
                          name="note"
                          placeholder="a reason, if you want to give one"
                          className="flex-1 min-w-0 text-sm px-2 py-2 rounded bg-neutral-950 border border-white/15 text-white"
                        />
                        <button className="text-sm px-3 py-2 rounded border border-red-500/50 text-red-300 hover:bg-red-500/10 shrink-0">
                          Stay
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Asking to leave */}
          <section>
            <h2 className="font-display text-xl mb-3">Asking for a move</h2>
            {openAsk ? (
              <div className="bg-neutral-900 border border-amber-700/50 rounded-lg p-4">
                <p className="text-sm">
                  You have asked {openAsk.team?.name ?? "your club"} for a move.
                </p>
                {openAsk.reason && (
                  <p className="text-xs text-slate-400 mt-1 break-words">
                    “{openAsk.reason}”
                  </p>
                )}
                <form
                  action={withdrawMoveRequest.bind(null, openAsk.request_id)}
                  className="mt-3"
                >
                  <button className="text-xs px-3 py-1.5 rounded border border-white/20 text-slate-300 hover:border-white/50">
                    Withdraw it
                  </button>
                </form>
              </div>
            ) : !live ? (
              <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-4 text-sm text-slate-400">
                You are out of contract, so you do not need anybody&apos;s
                permission to talk to a club.
              </p>
            ) : (
              <form
                action={requestMove}
                className="bg-neutral-900 border border-white/10 rounded-lg p-4 grid gap-2"
              >
                <p className="text-sm text-slate-400">
                  You can formally ask {liveClub} to let you move. They can
                  agree or refuse, and either way it is on record.
                </p>
                <input
                  name="reason"
                  placeholder="Why you want to move — optional"
                  className="px-3 py-2 rounded bg-neutral-950 border border-white/15 text-white text-sm"
                />
                <div>
                  <button className="text-sm font-medium px-4 py-2 rounded border border-white/20 hover:border-white/50">
                    Ask for a move
                  </button>
                </div>
              </form>
            )}

            {requests.filter((r) => r.status !== "pending").length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {requests
                  .filter((r) => r.status !== "pending")
                  .slice(0, 5)
                  .map((r) => (
                    <li
                      key={r.request_id}
                      className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-xs flex justify-between gap-3"
                    >
                      <span className="text-slate-400 truncate">
                        {String(r.created_at).slice(0, 10)} · {r.team?.name}
                        {r.club_note ? ` — ${r.club_note}` : ""}
                      </span>
                      <span className="text-slate-300 shrink-0">
                        {ASK_WORDS[r.status] ?? r.status}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Everything else that has been asked about you */}
          {otherBids.length > 0 && (
            <section>
              <h2 className="font-display text-xl mb-3">Approaches for you</h2>
              <ul className="bg-neutral-900 border border-white/10 rounded-lg divide-y divide-white/5">
                {otherBids.slice(0, 10).map((b) => (
                  <li key={b.request_id} className="px-4 py-2.5 text-sm flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">
                        {b.to_team?.name}
                        <span className="text-slate-500">
                          {" "}
                          · {b.kind === "loan" ? "loan" : "transfer"}
                        </span>
                      </span>
                      <span className="block text-xs text-slate-500">
                        {String(b.requested_at).slice(0, 10)}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 self-center">
                      {b.status === "with_club"
                        ? "your club is deciding"
                        : b.status === "with_federation"
                        ? "with the federation"
                        : b.status === "approved"
                        ? "done"
                        : b.status === "rejected"
                        ? "your club said no"
                        : b.status === "player_declined"
                        ? "you said no"
                        : b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Where you have been */}
      <section>
        <h2 className="font-display text-xl mb-3">Your clubs</h2>
        {spells.length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-6 text-center text-slate-500 text-sm">
            Nothing on record yet.
          </p>
        ) : (
          <ul className="bg-neutral-900 border border-white/10 rounded-lg divide-y divide-white/5">
            {spells.map((h) => (
              <li key={h.history_id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <Avatar src={h.team?.logo_url} name={h.team?.name} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.team?.name ?? "Unknown club"}</span>
                  {h.notes && (
                    <span className="block text-xs text-slate-500 truncate">{h.notes}</span>
                  )}
                </span>
                <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                  {h.season}
                  {h.role && h.role !== "player" ? ` · ${h.role}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
