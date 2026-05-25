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

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SuspensionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);
  const q = (first(searchParams?.q) ?? "").trim();

  // Pre-fetch matching player IDs for name search
  let playerIdFilter: string[] | null = null;
  if (q) {
    const { data: matchPlayers } = await supabase
      .from("players")
      .select("player_id")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    playerIdFilter = (matchPlayers ?? []).map((p: any) => p.player_id as string);
  }

  let suspQuery = supabase
    .from("suspensions")
    .select(
      "suspension_id, reason, matches_banned, start_date, end_date, status, player:player_id(first_name, last_name, team:team_id(name))",
      { count: "exact" }
    )
    .order("start_date", { ascending: false })
    .range(from, to);

  if (playerIdFilter !== null) {
    if (playerIdFilter.length === 0) {
      suspQuery = suspQuery.eq("suspension_id", "00000000-0000-0000-0000-000000000000");
    } else {
      suspQuery = suspQuery.in("player_id", playerIdFilter);
    }
  }

  const [{ data: suspensions, error, count }, { count: activeCount }] =
    await Promise.all([
      suspQuery,
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

      <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search player</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Player name…"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Search
        </button>
        {q && (
          <Link href="/admin/suspensions" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Player</th>
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Reason</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Matches</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Start</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">End</th>
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(suspensions ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No suspensions recorded.{" "}
                  <Link href="/admin/suspensions/new" className="text-navy-700 hover:underline">
                    Record one →
                  </Link>
                </td>
              </tr>
            ) : (
              (suspensions ?? []).map((s: any) => (
                <tr key={s.suspension_id} className="hover:bg-slate-50">
                  {/* Player — mobile shows team, status, dates below */}
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-navy-900">
                      {s.player ? `${s.player.first_name} ${s.player.last_name}` : "—"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.player?.team?.name ?? "—"}
                    </p>
                    {/* Mobile-only detail row */}
                    <div className="sm:hidden mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        s.status === "active" ? "bg-red-100 text-red-800" :
                        s.status === "served" ? "bg-emerald-50 text-emerald-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{s.status ?? "—"}</span>
                      {s.matches_banned && <span>· {s.matches_banned} match{s.matches_banned !== 1 ? "es" : ""}</span>}
                      {s.start_date && <span>· {fmt(s.start_date)}</span>}
                    </div>
                    {s.reason && (
                      <p className="sm:hidden text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{s.reason}</p>
                    )}
                  </td>

                  <td className="hidden sm:table-cell px-4 py-2.5 text-slate-600 max-w-[200px]">
                    <span className="line-clamp-2">{s.reason ?? "—"}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 text-center">{s.matches_banned ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(s.start_date)}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(s.end_date)}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === "active" ? "bg-red-100 text-red-800" :
                      s.status === "served" ? "bg-emerald-50 text-emerald-700" :
                      s.status === "overturned" ? "bg-slate-100 text-slate-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {s.status ?? "—"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {/* Mobile: just Edit */}
                    <Link
                      href={`/admin/suspensions/${s.suspension_id}`}
                      className="sm:hidden inline-block bg-navy-900 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-navy-700"
                    >
                      Edit
                    </Link>
                    {/* Desktop: status buttons + Edit + Delete */}
                    <span className="hidden sm:inline-flex items-center gap-2">
                      <SuspensionStatusButtons id={s.suspension_id} status={s.status} action={markSuspensionStatus} />
                      <Link href={`/admin/suspensions/${s.suspension_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                      <DeleteRowButton id={s.suspension_id} action={deleteSuspension} />
                    </span>
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
