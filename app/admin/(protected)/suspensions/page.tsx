import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { SuspensionStatusButtons } from "@/components/admin/SuspensionStatusButtons";
import { getPageParams } from "@/lib/pagination";
import { deleteSuspension, markSuspensionStatus } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SuspensionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);

  const [{ data: suspensions, error, count }, { count: activeCount }] =
    await Promise.all([
      supabase
        .from("suspensions")
        .select(
          "suspension_id, reason, matches_banned, start_date, end_date, status, player:player_id(first_name, last_name, team:team_id(name))",
          { count: "exact" }
        )
        .order("start_date", { ascending: false })
        .range(from, to),
      supabase
        .from("suspensions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["suspensions"]} />
      <ListHeader title="Suspensions" addHref="/admin/suspensions/new" addLabel="Add Suspension" />

      {(activeCount ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm px-3 py-2 rounded mb-4">
          <strong>{activeCount}</strong> active suspension{activeCount === 1 ? "" : "s"}.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Player</th>
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 font-medium">Matches</th>
              <th className="px-4 py-2.5 font-medium">Start</th>
              <th className="px-4 py-2.5 font-medium">End</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(suspensions ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No suspensions recorded.{" "}
                  <Link href="/admin/suspensions/new" className="text-navy-700 hover:underline">
                    Record one →
                  </Link>
                </td>
              </tr>
            ) : (
              (suspensions ?? []).map((s: any) => (
                <tr key={s.suspension_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {s.player ? `${s.player.first_name} ${s.player.last_name}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{s.player?.team?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-[240px] truncate">{s.reason ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.matches_banned ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmt(s.start_date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmt(s.end_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === "active" ? "bg-red-100 text-red-800" :
                      s.status === "served" ? "bg-emerald-50 text-emerald-700" :
                      s.status === "overturned" ? "bg-slate-100 text-slate-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {s.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <SuspensionStatusButtons id={s.suspension_id} status={s.status} action={markSuspensionStatus} />
                    <Link href={`/admin/suspensions/${s.suspension_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={s.suspension_id} action={deleteSuspension} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}
