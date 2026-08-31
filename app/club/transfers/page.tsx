import Link from "next/link";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { TransferMarket } from "@/components/club/TransferMarket";
import { getTransferWindow } from "@/lib/transferWindow";
import { remaining, type Contract } from "@/lib/contracts";
import { requestPlayer, withdrawRequest, answerRequest } from "./actions";

export const dynamic = "force-dynamic";

const WORDS: Record<string, string> = {
  with_club: "Waiting on them",
  rejected: "Turned down",
  with_federation: "With the federation",
  approved: "Done",
  declined: "Refused",
  withdrawn: "Withdrawn",
};

const TONE: Record<string, string> = {
  with_club: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  with_federation: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  withdrawn: "bg-slate-100 text-slate-600",
};

const SELECT =
  "request_id, kind, loan_until, status, message, club_note, review_note, requested_at, player:player_id(player_id, first_name, last_name, photo_url, position), from_team:from_team_id(name), to_team:to_team_id(name)";

function name(r: any) {
  const p = Array.isArray(r.player) ? r.player[0] : r.player;
  return `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "A player";
}

export default async function ClubTransfersPage({
  searchParams,
}: {
  searchParams?: { tab?: string; error?: string; note?: string };
}) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();
  const tab = searchParams?.tab ?? "market";
  const market = await getTransferWindow();

  const [{ data: teams }, { data: players }, { data: sent, error }, { data: received }, { data: liveContracts }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("team_id, name, logo_url")
        .eq("team_type", "club")
        // Retired clubs are not somewhere new things can be filed.
        .neq("is_public", false)
        .neq("team_id", teamId)
        .order("name"),
      // or(...) rather than neq: a player with no club has a null team_id,
      // and "team_id <> ours" is null for them — so neq alone quietly hides
      // every free agent.
      supabase
        .from("players")
        .select("player_id, first_name, last_name, position, photo_url, category, team_id")
        .or(`team_id.is.null,team_id.neq.${teamId}`)
        .eq("playing_status", "active")
        .eq("approval_status", "approved")
        .order("last_name")
        .limit(1000),
      supabase.from("transfer_requests").select(SELECT).eq("to_team_id", teamId).order("requested_at", { ascending: false }),
      supabase.from("transfer_requests").select(SELECT).eq("from_team_id", teamId).order("requested_at", { ascending: false }),
      // What each player is tied up for. A player with two years to run is a
      // different proposition from one out of contract in a month, and the
      // list is unreadable without it.
      supabase
        .from("contracts")
        .select("contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at")
        .eq("status", "accepted"),
    ]);

  const outgoing = (sent ?? []) as any[];
  const incoming = (received ?? []) as any[];
  const waiting = incoming.filter((r) => r.status === "with_club").length;
  const notMigrated = !!error && /transfer_requests/.test(error.message);

  // player_id -> "1 year 4 months"
  const contractLeft: Record<string, string> = {};
  for (const c of ((liveContracts ?? []) as any[])) {
    const left = remaining(c as Contract);
    if (left) contractLeft[c.player_id] = left.label;
  }

  const openFor = outgoing
    .filter((r) => r.status === "with_club" || r.status === "with_federation")
    .map((r) => (Array.isArray(r.player) ? r.player[0] : r.player)?.player_id)
    .filter(Boolean);

  const Tab = ({ id, label, count }: { id: string; label: string; count?: number }) => (
    <Link
      href={`/club/transfers?tab=${id}`}
      className={`px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${
        tab === id
          ? "border-navy-900 text-navy-900 font-medium"
          : "border-transparent text-slate-500 hover:text-navy-700"
      }`}
    >
      {label}
      {!!count && count > 0 && (
        <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
          {count}
        </span>
      )}
    </Link>
  );

  const Card = ({ r, mine }: { r: any; mine: boolean }) => (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-navy-900 break-words">{name(r)}</p>
          <p className="text-xs text-slate-500">
            {r.kind === "loan" ? "Loan" : "Transfer"}
            {r.kind === "loan" && r.loan_until ? ` until ${r.loan_until}` : ""}
            {" · "}
            {mine
              ? `from ${r.from_team?.name ?? "no club — free agent"}`
              : `to ${r.to_team?.name ?? "them"}`}
          </p>
          {r.message && (
            <p className="text-xs text-slate-600 mt-1.5 italic">“{r.message}”</p>
          )}
          {r.club_note && (
            <p className="text-xs text-slate-600 mt-1">Their reply: {r.club_note}</p>
          )}
          {r.review_note && (
            <p className="text-xs text-red-700 mt-1">Federation: {r.review_note}</p>
          )}
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
            TONE[r.status] ?? TONE.withdrawn
          }`}
        >
          {WORDS[r.status] ?? r.status}
        </span>
      </div>

      {mine && r.status === "with_club" && (
        <form action={withdrawRequest.bind(null, r.request_id)} className="mt-3 flex justify-end">
          <button className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
            Withdraw
          </button>
        </form>
      )}

      {!mine && r.status === "with_club" && (
        <div className="mt-3 grid gap-2">
          <input
            form={`answer-${r.request_id}`}
            name="note"
            placeholder="A note back — optional"
            className="px-2 py-1.5 rounded border border-slate-300 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <form id={`reject-${r.request_id}`} action={answerRequest.bind(null, r.request_id, false)}>
              <button className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50">
                Turn down
              </button>
            </form>
            <form id={`answer-${r.request_id}`} action={answerRequest.bind(null, r.request_id, true)}>
              <button className="text-xs font-medium px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white">
                Agree to it
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-navy-900">Transfers</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Ask another club about a player. They answer, and the federation
          signs off anything they agree to — nobody moves before that.
        </p>
        <p className="text-xs mt-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${
              market.open ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className={market.open ? "text-emerald-800" : "text-red-800"}>
            {market.open ? "Market open" : "Market closed"}
          </span>
          {market.reason && <span className="text-slate-500"> — {market.reason}</span>}
        </p>
      </div>

      {searchParams?.error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.note}
        </div>
      )}

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/transfer_requests.sql</code> to
          turn this on.
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
            <Tab id="market" label="Find a player" />
            <Tab id="received" label="Asked of you" count={waiting} />
            <Tab id="sent" label="Your enquiries" />
          </div>

          {tab === "market" && !market.open && (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <p className="font-display text-lg text-navy-900">
                The transfer market is closed
              </p>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                {market.reason}
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Requests already made can still be answered while it is shut.
              </p>
            </div>
          )}

          {tab === "market" && market.open && (
            <TransferMarket
              teams={(teams ?? []) as any}
              players={(players ?? []) as any}
              openFor={openFor}
              contractLeft={contractLeft}
              request={requestPlayer}
            />
          )}

          {tab === "received" && (
            <div className="grid gap-3">
              {incoming.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                  No club has asked about your players.
                </div>
              ) : (
                incoming.map((r) => <Card key={r.request_id} r={r} mine={false} />)
              )}
            </div>
          )}

          {tab === "sent" && (
            <div className="grid gap-3">
              {outgoing.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                  You have not asked about anybody yet.
                </div>
              ) : (
                outgoing.map((r) => <Card key={r.request_id} r={r} mine={true} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
