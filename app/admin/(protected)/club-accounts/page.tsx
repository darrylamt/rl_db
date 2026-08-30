import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { createClubAccount, revokeClubAccount } from "./actions";

export const dynamic = "force-dynamic";

const CURRENT_YEAR = new Date().getFullYear();

export default async function ClubAccountsPage({
  searchParams,
}: {
  searchParams?: { error?: string; created?: string; note?: string };
}) {
  const supabase = createAdminClient();

  const problem = searchParams?.error;
  const good = searchParams?.created
    ? `${searchParams.created} can now sign in at /login and fill in their squad.`
    : searchParams?.note;

  const [{ data: accounts, error }, { data: teams }, { data: seasonFixtures }] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("user_id, role, email, created_at, team:team_id(team_id, name, logo_url)")
        .order("created_at", { ascending: false }),
      supabase
        .from("teams")
        .select("team_id, name")
        .eq("team_type", "club")
        .order("name"),
      supabase
        .from("fixtures")
        .select("home_team_id, away_team_id, competition:competition_id!inner(season)")
        .eq("competition.season", String(CURRENT_YEAR)),
    ]);

  const rows = (accounts ?? []) as any[];
  const clubAccounts = rows.filter((r) => r.role === "club");
  const federationCount = rows.filter((r) => r.role === "federation").length;

  // Who is actually playing this season — those are the clubs that need a
  // login, rather than every club ever entered.
  const playing = new Set<string>();
  for (const f of (seasonFixtures ?? []) as any[]) {
    if (f.home_team_id) playing.add(f.home_team_id);
    if (f.away_team_id) playing.add(f.away_team_id);
  }
  const withAccount = new Set(clubAccounts.map((a) => a.team?.team_id).filter(Boolean));
  const missing = (teams ?? []).filter(
    (t: any) => playing.has(t.team_id) && !withAccount.has(t.team_id)
  );

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Club Accounts" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        A club account signs in to its own portal and can fill in its squad —
        photos, positions, jersey numbers. It cannot reach the admin, cannot see
        another club, and cannot register a player for a season. That stays here.
      </p>

      {problem && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded mb-4">
          {problem}
        </div>
      )}

      {good && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm px-3 py-2.5 rounded mb-4">
          {good}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
          <span className="block text-xs mt-1">
            If this says app_users does not exist, run supabase/club_accounts.sql first.
          </span>
        </div>
      )}

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 text-sm text-amber-900">
          <strong>{missing.length}</strong> club
          {missing.length === 1 ? "" : "s"} playing in {CURRENT_YEAR} with no
          login yet: {missing.map((t: any) => t.name).join(", ")}.
        </div>
      )}

      {/* Issue a login */}
      <form
        action={createClubAccount}
        className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-4 items-end"
      >
        <div className="sm:col-span-4">
          <h2 className="font-display text-lg text-navy-900">Issue a login</h2>
          <p className="text-xs text-slate-500">
            Set the first password yourself and pass it to the club — they can
            use it straight away.
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Club</span>
          <select
            name="team_id"
            required
            defaultValue=""
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          >
            <option value="">— select club —</option>
            {(teams ?? []).map((t: any) => (
              <option key={t.team_id} value={t.team_id}>
                {t.name}
                {withAccount.has(t.team_id) ? " (has one)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="club@example.com"
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            First password
          </span>
          <input
            type="text"
            name="password"
            required
            minLength={8}
            placeholder="at least 8 characters"
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
        </label>
        <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded">
          Create account
        </button>
      </form>

      {/* Existing accounts */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Club</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clubAccounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No club logins yet.
                </td>
              </tr>
            ) : (
              clubAccounts.map((a) => (
                <tr key={a.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {a.team?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{a.email ?? "—"}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-slate-500 text-xs">
                    {a.created_at ? String(a.created_at).slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteRowButton
                      id={a.user_id}
                      action={revokeClubAccount}
                      label="Revoke"
                      confirmText="Remove this club's login? They will be signed out and cannot sign in again."
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        {federationCount} federation account{federationCount === 1 ? "" : "s"} — those keep
        full access to this admin and are not listed here.{" "}
        <Link href="/admin/players" className="text-navy-700 hover:underline">
          Players →
        </Link>
      </p>
    </div>
  );
}
