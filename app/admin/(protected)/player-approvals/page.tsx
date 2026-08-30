import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { ApprovalCard } from "@/components/admin/ApprovalCard";
import { approvePlayer, declinePlayer, reopenPlayer } from "./actions";

export const dynamic = "force-dynamic";

const SELECT =
  "player_id, first_name, last_name, position, jersey_number, date_of_birth, photo_url, nationality, height_cm, weight_kg, approval_status, submitted_at, review_note, reviewed_at, team:team_id(team_id, name, logo_url)";

export default async function PlayerApprovalsPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("players")
    .select(SELECT)
    .in("approval_status", ["pending", "declined"])
    .order("submitted_at", { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as any[];
  const pending = rows.filter((p) => p.approval_status === "pending");
  const declined = rows.filter((p) => p.approval_status === "declined");

  // The column is missing until the migration is run, and the error text is
  // not something to put in front of anyone.
  const notMigrated =
    !!error && /approval_status/.test(error.message) && /column/i.test(error.message);

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Player Approvals" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Players a club has added from its own portal. They belong to the club
        and the club can finish their details, but they stay off the register
        and off the public site until you approve them.
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

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/player_approvals.sql</code> to
          turn this on. Until then a club&apos;s new player joins the register
          straight away, as before.
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded">
          {error.message}
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-3">
              Waiting on you{pending.length > 0 && ` (${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                Nothing waiting. Players a club adds will appear here.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pending.map((p) => (
                  <ApprovalCard
                    key={p.player_id}
                    player={p}
                    approve={approvePlayer}
                    decline={declinePlayer}
                  />
                ))}
              </div>
            )}
          </section>

          {declined.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-navy-900 mb-1">
                Declined ({declined.length})
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Kept rather than deleted, so the club can see the decision and
                the reason. Put one back in the queue if they have fixed it.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {declined.map((p) => (
                  <ApprovalCard
                    key={p.player_id}
                    player={p}
                    approve={approvePlayer}
                    decline={declinePlayer}
                    reopen={reopenPlayer}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 mt-6">
        <Link href="/admin/players" className="text-navy-700 hover:underline">
          All players →
        </Link>
      </p>
    </div>
  );
}
