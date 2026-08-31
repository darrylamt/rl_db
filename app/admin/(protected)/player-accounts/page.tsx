import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { PlayerAccountRow } from "@/components/admin/PlayerAccountRow";
import { CopyEmails } from "@/components/admin/CopyEmails";
import { GRADES, isGrade, gradeLabel } from "@/lib/grades";
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
  searchParams?: {
    q?: string;
    error?: string;
    note?: string;
    show?: string;
    team?: string;
    status?: string;
    grade?: string;
  };
}) {
  const supabase = createAdminClient();
  const q = (searchParams?.q ?? "").trim();
  const showWithout = searchParams?.show === "without";
  const team = (searchParams?.team ?? "").trim();
  // Active is the useful default: an inactive player rarely needs a login,
  // and 338 of them would bury the ones who do.
  const status = searchParams?.status ?? "active";
  const grade = (searchParams?.grade ?? "").trim();

  const [{ data: accounts, error }, { data: players }, { data: teams }] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("user_id, email, player_id, must_change_password, created_at")
        .eq("role", "player"),
      supabase
        .from("players")
        .select(
          "player_id, first_name, last_name, position, photo_url, playing_status, team_id, team:team_id(name)",
        )
        .order("last_name")
        .limit(1000),
      supabase
        .from("teams")
        .select("team_id, name")
        .eq("team_type", "club")
        .neq("is_public", false)
        .order("name"),
    ]);

  const notMigrated =
    !!error && /must_change_password|player_id/.test(error.message);

  const accountFor = new Map(
    ((accounts ?? []) as any[]).map((a) => [a.player_id, a]),
  );

  const all = ((players ?? []) as any[]).map((p) => ({
    ...p,
    account: accountFor.get(p.player_id) ?? null,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed",
  }));

  const needle = q.toLowerCase();
  const matched = all.filter((p) => {
    if (showWithout && p.account) return false;
    if (team && p.team_id !== team) return false;
    if (!isGrade(p.category, grade)) return false;
    if (status === "active" && p.playing_status !== "active") return false;
    if (status === "inactive" && p.playing_status === "active") return false;
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
    (a) => a.must_change_password,
  ).length;

  // A long list is not a list anyone reads; filtering is how this page is
  // used. With a filter on, everything matching is shown, because the copy
  // button takes what is on screen and a capped list would quietly copy a
  // fraction of what was asked for.
  const filtered = !!(q || showWithout || team || grade || status !== "all");
  const shown = filtered ? matched : matched.slice(0, 60);

  // What the copy button takes: those on screen who have an address.
  const copyable = shown
    .filter((p) => p.account?.email)
    .map((p) => ({ name: p.name, email: p.account.email as string }));

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Player Accounts" />

      <p className="text-sm text-slate-500 -mt-3 mb-4 max-w-2xl">
        Every player&apos;s sign-in address, so you can tell them what it is.
        Search by name, address, club or position. They all start on{" "}
        <code className="font-mono bg-slate-100 px-1 rounded">{SHARED}</code>{" "}
        and cannot reach anything until they have changed it.
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
          Run{" "}
          <code className="font-mono">supabase/contracts_and_players.sql</code>{" "}
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
              <div
                key={s.label}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {s.label}
                </p>
                <p className="font-display text-3xl font-bold text-navy-900 tabular-nums">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <form className="bg-white border border-slate-200 rounded-lg p-3 mb-4 flex gap-2 flex-wrap items-end">
            <label className="text-sm flex-1 min-w-[13rem]">
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Search
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Name, address, club or position"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
              />
            </label>

            <label className="text-sm">
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Club
              </span>
              <select
                name="team"
                defaultValue={team}
                className="px-3 py-2 rounded border border-slate-300 text-sm"
              >
                <option value="">All clubs</option>
                {((teams ?? []) as any[]).map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Grade
              </span>
              <select
                name="grade"
                defaultValue={grade}
                className="px-3 py-2 rounded border border-slate-300 text-sm"
              >
                <option value="">All grades</option>
                {GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Status
              </span>
              <select
                name="status"
                defaultValue={status}
                className="px-3 py-2 rounded border border-slate-300 text-sm"
              >
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="all">Everyone</option>
              </select>
            </label>

            {showWithout && <input type="hidden" name="show" value="without" />}

            <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded">
              Apply
            </button>

            <a
              href={`/admin/player-accounts?${new URLSearchParams({
                ...(showWithout ? {} : { show: "without" }),
                status,
                ...(team ? { team } : {}),
                ...(grade ? { grade } : {}),
                ...(q ? { q } : {}),
              })}`}
              className={`text-sm px-3 py-2 rounded border ${
                showWithout
                  ? "bg-amber-100 border-amber-300 text-amber-900"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {showWithout
                ? "Showing those without a login"
                : "Only those without a login"}
            </a>
          </form>

          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <p className="text-sm text-slate-500">
              {shown.length === matched.length
                ? `${shown.length} shown`
                : `${shown.length} of ${matched.length} shown`}
            </p>
            <CopyEmails rows={copyable} />
          </div>

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
              Showing the first {shown.length} of {matched.length}. Use a filter
              to see them all and copy the whole set.
            </p>
          )}
        </>
      )}
    </div>
  );
}
