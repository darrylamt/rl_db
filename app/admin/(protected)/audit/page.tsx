import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

/** The tables worth offering as a filter, in the order they get asked about. */
const ENTITIES = [
  "app_users", "match_events", "match_results", "match_lineups",
  "fixtures", "players", "player_registrations", "teams",
  "suspensions", "articles",
];

function tone(action: string) {
  if (action.endsWith(".delete")) return "bg-red-100 text-red-800";
  if (action.endsWith(".insert")) return "bg-emerald-100 text-emerald-800";
  if (action.endsWith(".update")) return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

/** "match_events.insert" reads better as "added". */
function verb(action: string) {
  if (action.endsWith(".insert")) return "added";
  if (action.endsWith(".update")) return "changed";
  if (action.endsWith(".delete")) return "removed";
  return action.replace(/^account\./, "").replace(/_/g, " ");
}

/** The fields an update actually touched, minus the noise. */
function changedFields(detail: any): string[] {
  const changed = detail?.changed;
  if (!changed || typeof changed !== "object") return [];
  return Object.keys(changed).filter((k) => k !== "updated_at");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: { page?: string; actor?: string; entity?: string };
}) {
  const supabase = createAdminClient();
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  let query = supabase
    .from("audit_log")
    .select("entry_id, at, actor_email, actor_role, action, entity, entity_id, summary, detail", {
      count: "exact",
    })
    .order("at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  if (searchParams?.actor) query = query.eq("actor_email", searchParams.actor);
  if (searchParams?.entity) query = query.eq("entity", searchParams.entity);

  const { data, error, count } = await query;
  const rows = (data ?? []) as any[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Audit Trail" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Every change, whoever made it — the admin, a club in their portal, a
        recorder on a phone at a ground, or a migration run in the SQL editor.
        Recorded by the database itself, so nothing is written without leaving
        a line here.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
          <span className="block text-xs mt-1">
            If this says audit_log does not exist, run
            supabase/account_holds_and_audit.sql, then
            supabase/audit_all_changes.sql.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4 text-xs">
        <Link
          href="/admin/audit"
          className={`px-2.5 py-1 rounded border ${
            !searchParams?.entity && !searchParams?.actor
              ? "bg-navy-900 text-white border-navy-900"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Everything
        </Link>
        {ENTITIES.map((e) => (
          <Link
            key={e}
            href={`/admin/audit?entity=${e}`}
            className={`px-2.5 py-1 rounded border ${
              searchParams?.entity === e
                ? "bg-navy-900 text-white border-navy-900"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {e.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {searchParams?.actor && (
        <p className="text-sm mb-3">
          Showing only <strong>{searchParams.actor}</strong>.{" "}
          <Link href="/admin/audit" className="text-navy-700 hover:underline">
            Show everyone
          </Link>
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium w-40">When</th>
              <th className="px-4 py-2.5 font-medium">What</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium w-56">Who</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                  Nothing recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.entry_id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(r.at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 ${tone(
                        r.action
                      )}`}
                    >
                      {verb(r.action)}
                    </span>
                    <span className="text-navy-900">
                      {r.summary ?? (r.entity ?? "").replace(/_/g, " ")}
                    </span>
                    {changedFields(r.detail).length > 0 && (
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {changedFields(r.detail).slice(0, 6).join(", ")}
                      </span>
                    )}
                    {r.detail?.reason && (
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {r.detail.reason}
                      </span>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 text-xs">
                    {r.actor_email ? (
                      <Link
                        href={`/admin/audit?actor=${encodeURIComponent(r.actor_email)}`}
                        className="hover:underline"
                      >
                        {r.actor_email}
                      </Link>
                    ) : (
                      <span className="text-slate-400">not signed in</span>
                    )}
                    {r.actor_role && (
                      <span className="block text-slate-400">{r.actor_role}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-slate-500">
            {total} entr{total === 1 ? "y" : "ies"} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit?page=${page - 1}${searchParams?.actor ? `&actor=${encodeURIComponent(searchParams.actor)}` : ""}`}
                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
              >
                Newer
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/admin/audit?page=${page + 1}${searchParams?.actor ? `&actor=${encodeURIComponent(searchParams.actor)}` : ""}`}
                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
              >
                Older
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
