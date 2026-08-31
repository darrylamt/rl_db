import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { OfferContractForm } from "@/components/club/OfferContractForm";
import {
  remaining,
  monthsBetween,
  describeLength,
  daysUntil,
  describeDays,
  RENEWAL_WINDOW_DAYS,
  type Contract,
} from "@/lib/contracts";
import { offerContract, withdrawOffer, terminateContract } from "./actions";

export const dynamic = "force-dynamic";

const WORDS: Record<string, string> = {
  offered: "Waiting on the player",
  accepted: "Signed",
  declined: "Turned down",
  withdrawn: "Withdrawn",
  terminated: "Ended",
};

const TONE: Record<string, string> = {
  offered: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  withdrawn: "bg-slate-100 text-slate-600",
  terminated: "bg-slate-100 text-slate-600",
};

export default async function ClubContractsPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const [{ data: squad }, { data: contracts, error }] = await Promise.all([
    supabase
      .from("players")
      .select("player_id, first_name, last_name, position, photo_url")
      .eq("team_id", teamId)
      .eq("playing_status", "active")
      .order("last_name"),
    supabase
      .from("contracts")
      .select(
        "contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at, ended_note, player:player_id(first_name, last_name, photo_url, position)"
      )
      .eq("team_id", teamId)
      .order("offered_at", { ascending: false }),
  ]);

  const rows = (contracts ?? []) as any[];
  const notMigrated = !!error && /contracts/.test(error.message);

  const open = rows.filter((c) => c.status === "offered");
  const signed = rows.filter((c) => c.status === "accepted");
  const past = rows.filter((c) =>
    ["declined", "withdrawn", "terminated"].includes(c.status)
  );

  // Who a club may put terms to: anybody with nothing running, and anybody
  // whose contract is inside its last month. Waiting for a contract to lapse
  // before re-signing means negotiating with somebody every other club is
  // free to talk to — which is the wrong moment to start.
  const runningFor = new Map<string, any>();
  for (const c of signed) runningFor.set(c.player_id, c);

  const offerable = ((squad ?? []) as any[])
    .filter((p) => !open.some((o) => o.player_id === p.player_id))
    .map((p) => {
      const current = runningFor.get(p.player_id);
      if (!current) return { ...p, renewal: null as any };
      const days = daysUntil(current.ends_on);
      if (days > RENEWAL_WINDOW_DAYS) return null;
      return { ...p, renewal: current };
    })
    .filter(Boolean) as any[];

  // Whose terms run out soonest, so the urgent ones lead the list.
  offerable.sort((a, b) => {
    const ad = a.renewal ? daysUntil(a.renewal.ends_on) : 9999;
    const bd = b.renewal ? daysUntil(b.renewal.ends_on) : 9999;
    return ad - bd;
  });

  const renewalsDue = offerable.filter((p) => p.renewal).length;

  const Card = ({ c }: { c: any }) => {
    const p = Array.isArray(c.player) ? c.player[0] : c.player;
    const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Unnamed";
    const left = remaining(c as Contract);
    const length = describeLength(monthsBetween(c.starts_on, c.ends_on));

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            <Avatar src={p?.photo_url} name={name} size={40} />
            <div className="min-w-0">
              <p className="font-medium text-navy-900 break-words">{name}</p>
              <p className="text-xs text-slate-500">
                {length} · {c.starts_on} to {c.ends_on}
              </p>
              {left && (
                <p className="text-xs text-emerald-700 mt-0.5">
                  {left.label} left to run
                </p>
              )}
              {c.terms && (
                <p className="text-xs text-slate-600 mt-1 break-words">{c.terms}</p>
              )}
              {c.decline_note && (
                <p className="text-xs text-red-700 mt-1">Turned down — {c.decline_note}</p>
              )}
              {c.ended_note && (
                <p className="text-xs text-slate-600 mt-1">Ended — {c.ended_note}</p>
              )}
            </div>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
              TONE[c.status] ?? TONE.withdrawn
            }`}
          >
            {WORDS[c.status] ?? c.status}
          </span>
        </div>

        {c.status === "offered" && (
          <form action={withdrawOffer.bind(null, c.contract_id)} className="mt-3 flex justify-end">
            <button className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
              Withdraw offer
            </button>
          </form>
        )}

        {c.status === "accepted" && (
          <form
            action={terminateContract.bind(null, c.contract_id)}
            className="mt-3 flex gap-1.5 justify-end"
          >
            <input
              name="why"
              placeholder="why is it ending?"
              className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300"
            />
            <button className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 shrink-0">
              End it
            </button>
          </form>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-navy-900">Contracts</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Offer a player terms of six months to two years. An offer is only an
          offer — the player accepts it from their own account.
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
          Run <code className="font-mono">supabase/contracts_and_players.sql</code> to
          turn this on.
        </div>
      ) : (
        <>
          {renewalsDue > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-4">
              <strong>
                {renewalsDue} {renewalsDue === 1 ? "contract is" : "contracts are"} in
                the last month.
              </strong>{" "}
              You can re-sign those players now. Once a contract ends they are
              out of contract and any club can talk to them.
            </div>
          )}

          <OfferContractForm players={offerable} offer={offerContract} />

          {open.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg text-navy-900 mb-3">
                Waiting on the player ({open.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {open.map((c) => (
                  <Card key={c.contract_id} c={c} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="font-display text-lg text-navy-900 mb-3">
              Under contract ({signed.length})
            </h2>
            {signed.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                Nobody is signed yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {signed.map((c) => (
                  <Card key={c.contract_id} c={c} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg text-navy-900 mb-3">
                Finished and refused ({past.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {past.slice(0, 12).map((c) => (
                  <Card key={c.contract_id} c={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
