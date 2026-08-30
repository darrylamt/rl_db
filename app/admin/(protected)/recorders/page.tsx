import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { createRecorderAccount, revokeRecorderAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecordersPage({
  searchParams,
}: {
  searchParams?: { error?: string; created?: string; note?: string };
}) {
  const supabase = createAdminClient();

  const problem = searchParams?.error;
  const good = searchParams?.created
    ? `${searchParams.created} can now sign in at /login and record matches.`
    : searchParams?.note;

  const { data: accounts, error } = await supabase
    .from("app_users")
    .select("user_id, role, email, created_at")
    .eq("role", "recorder")
    .order("created_at", { ascending: false });

  const rows = (accounts ?? []) as any[];

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Match Recorders" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        A recorder signs in on a phone at the ground and types the match in —
        scores, tries, cards. They reach the match-day screens and nothing
        else: not this admin, not a club portal. What they save is what the
        public live page shows.
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
            If this says app_users does not exist, run supabase/club_accounts.sql,
            then supabase/recorder_accounts.sql.
          </span>
        </div>
      )}

      <form
        action={createRecorderAccount}
        className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-3 items-end"
      >
        <div className="sm:col-span-3">
          <h2 className="font-display text-lg text-navy-900">Issue a login</h2>
          <p className="text-xs text-slate-500">
            Set the first password yourself and hand it over. Send them to{" "}
            <span className="font-mono text-navy-800">/enter</span> on the day.
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="recorder@example.com"
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

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No recorder logins yet — match entry is federation-only until
                  you issue one.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{a.email ?? "—"}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-slate-500 text-xs">
                    {a.created_at ? String(a.created_at).slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteRowButton
                      id={a.user_id}
                      action={revokeRecorderAccount}
                      label="Revoke"
                      confirmText="Remove this recorder's login? They will be signed out and cannot sign in again."
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Your own federation account can already record matches, so you do not
        need one of these to enter a result yourself.{" "}
        <Link href="/enter" className="text-navy-700 hover:underline">
          Open match entry →
        </Link>
      </p>
    </div>
  );
}
