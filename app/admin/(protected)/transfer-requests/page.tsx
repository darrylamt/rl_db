import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { TransferCard } from "@/components/admin/TransferCard";
import { TransferWindowPanel } from "@/components/admin/TransferWindowPanel";
import { getTransferWindow } from "@/lib/transferWindow";
import { approveTransfer, declineTransfer } from "./actions";
import { setTransferMode, addTransferWindow, removeTransferWindow } from "./window-actions";

export const dynamic = "force-dynamic";

const SELECT =
  "request_id, kind, loan_until, status, message, club_note, review_note, requested_at, club_answered_at, reviewed_at, player:player_id(player_id, first_name, last_name, photo_url, position, team_id), from_team:from_team_id(team_id, name, logo_url), to_team:to_team_id(team_id, name, logo_url)";

export default async function TransferRequestsPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const supabase = createAdminClient();
  const market = await getTransferWindow();

  const { data, error } = await supabase
    .from("transfer_requests")
    .select(SELECT)
    .order("requested_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as any[];
  const notMigrated = !!error && /transfer_requests/.test(error.message);

  const waiting = rows.filter((r) => r.status === "with_federation");
  const settled = rows.filter((r) =>
    ["approved", "declined"].includes(r.status)
  );
  const betweenClubs = rows.filter((r) => r.status === "with_club");

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Transfer Requests" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Moves the clubs have agreed between themselves. Signing one off is
        what actually changes the player&apos;s registration and writes the
        move into their club history — nothing has moved before that.
      </p>

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

      <TransferWindowPanel
        state={market}
        setMode={setTransferMode}
        addWindow={addTransferWindow}
        removeWindow={removeTransferWindow}
      />

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/transfer_requests.sql</code> to
          turn this on.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-3">
              Waiting on you{waiting.length > 0 && ` (${waiting.length})`}
            </h2>
            {waiting.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                Nothing to sign off. Moves both clubs have agreed appear here.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {waiting.map((r) => (
                  <TransferCard
                    key={r.request_id}
                    request={r}
                    approve={approveTransfer}
                    decline={declineTransfer}
                  />
                ))}
              </div>
            )}
          </section>

          {betweenClubs.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-lg text-navy-900 mb-1">
                Between the clubs ({betweenClubs.length})
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Asked, and not yet answered by the club holding the player.
                Nothing for you to do until they reply.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {betweenClubs.map((r) => (
                  <TransferCard
                    key={r.request_id}
                    request={r}
                    approve={approveTransfer}
                    decline={declineTransfer}
                    readOnly
                  />
                ))}
              </div>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-navy-900 mb-3">
                Settled ({settled.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {settled.slice(0, 20).map((r) => (
                  <TransferCard
                    key={r.request_id}
                    request={r}
                    approve={approveTransfer}
                    decline={declineTransfer}
                    readOnly
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 mt-6">
        <Link href="/admin/transfers" className="text-navy-700 hover:underline">
          Every move on record →
        </Link>
      </p>
    </div>
  );
}
