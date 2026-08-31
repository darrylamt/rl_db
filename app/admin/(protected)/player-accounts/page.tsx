import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { PlayerAccountRow } from "@/components/admin/PlayerAccountRow";
import {
  resetPlayerPassword,
  revokePlayerAccount,
  createPlayerAccount,
} from "./actions";

export const dynamic = "force-dynamic";

const SHARED = "RLFG@08";

export default async function PlayerAccountsPage({
  searchParams,
}: {
  searchParams?: { q?: string; error?: string; note?: string; show?: string };
}) {
  const supabase = createAdminClient();
  const q = (searchParams?.q ?? "").trim();
  const showWithout = searchParams?.show === "without";

  const [{ data: accounts, error }, { data: players }] = await Promise.all([
    supabase
      .from("app_users")
      .select("user_id, email, player_id, must_change_password, created_at")
      .eq("role", "player"),
    supabase
      .from("players")
      .select("player_id, first_name, last_name, position, photo_url, playing_status, team:team_id(name)")
      .order("last_name")
      .limit(1000),
  ]);

  const notMigrated = !!error && /must_change_password|player_id/.test(error.message);

  const accountFor = new Map(
    ((accounts ?? []) as any[]).map((a) => [a.player_id, a])
  );

  const all = ((players ?? []) as any[]).map((p) => ({
    ...p,
    account: accountFor.get(p.player_id) ?? null,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed",
  }));

  const needle = q.toLowerCase();
  const matched = all.filter((p) => {
    if (showWithout && p.account) return false;
    if (!needle) return true;
    return (
      p.name.toLowerCase().includes(needle) ||
      (p.account?.email ?? "").toLowerCase().includes(needle) ||
      (p.team?.name ?? "").toLowerCase().includes(needle) ||
      (p.position ?? "").toLowerCase().includes(needle)
    );
  });

  const withAccount = all.filter((p) => p.account).length;
  const notYetChanged = ((accounts ?? []) as any[]).filter(
    (a) => a.must_change_password
  ).length;

  // A long list is not a list anyone reads; searching is how this page is used.
  const shown = matched.slice(0, q || showWithout ? 200 : 60);

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Player Accounts" />

      <p className="text-sm text-slate-500 -mt-3 mb-4 max-w-2xl">
        Every player&apos;s sign-in address, so you can tell them what it is.
        Search by name, address, club or position. They all start on{" "}
        <code className="font-mono bg-slate-100 px-1 rounded">{SHARED}</code> and
        cannot reach anything until they have changed it.
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
          Run <code className="font-mono">supabase/contracts_and_players.sql</code>{" "}
          to turn this on.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-5">
            {[
              { label: "Players with a login", value: withAccount },
              { label: "Still on the shared password", value: notYetChanged },
              { label: "Players with none", value: all.length - withAccount },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {s.label}
                </p>
                <p className="font-display text-3xl font-bold text-navy-900 tabular-nums">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <form className="flex gap-2 mb-4 flex-wrap">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, address, club or position"
              className="flex-1 min-w-[14rem] px-3 py-2 rounded border border-slate-300 text-sm"
            />
            {showWithout && <input type="hidden" name="show" value="without" />}
            <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded">
              Search
            </button>
            <a
              href={
                showWithout
                  ? `/admin/player-accounts${q ? `?q=${encodeURIComponent(q)}` : ""}`
                  : `/admin/player-accounts?show=without${q ? `&q=${encodeURIComponent(q)}` : ""}`
              }
              className={`text-sm px-3 py-2 rounded border ${
                showWithout
                  ? "bg-amber-100 border-amber-300 text-amber-900"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {showWithout ? "Showing those without a login" : "Only those without a login"}
            </a>
          </form>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-500 text-sm">
                {q ? `Nobody matches “${q}”.` : "No players on record."}
              </p>
            ) : (
              shown.map((p) => (
                <PlayerAccountRow
                  key={p.player_id}
                  player={p}
                  query={q}
                  resetPassword={resetPlayerPassword}
                  revoke={revokePlayerAccount}
                  create={createPlayerAccount}
                />
              ))
            )}
          </div>

          {matched.length > shown.length && (
            <p className="text-xs text-slate-500 mt-3">
              Showing {shown.length} of {matched.length}. Search to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  );
}
