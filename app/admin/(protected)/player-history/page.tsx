import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deletePlayerHistory } from "./actions";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PlayerHistoryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);
  const q = (first(searchParams?.q) ?? "").trim();

  // The table holds no name of its own, so a name search resolves to player ids
  // first — the same approach the suspensions list takes.
  let playerIdFilter: string[] | null = null;
  if (q) {
    const { data: matches } = await supabase
      .from("players")
      .select("player_id")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    playerIdFilter = (matches ?? []).map((p: any) => p.player_id as string);
  }

  let query = supabase
    .from("player_history")
    .select(
      "history_id, season, role, joined_date, left_date, notes, player:player_id(first_name, last_name), team:team_id(name)",
      { count: "exact" }
    )
    .order("joined_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (playerIdFilter !== null) {
    if (playerIdFilter.length === 0) {
      query = query.eq("history_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("player_id", playerIdFilter);
    }
  }

  const { data: rows, error, count } = await query;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["player_history"]} />
      <ListHeader
        title="Club History"
        addHref="/admin/player-history/new"
        addLabel="Add Spell"
      />

      <p className="text-sm text-slate-500 mb-4">
        Where a player has been, and when. A registration records who is signed on
        for one season; this is the record behind it — transfers, loans, and the
        years before.
      </p>

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
          <Link href="/admin/player-history" className="text-xs text-slate-500 hover:underline">clear</Link>
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
              <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Club</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Season</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Role</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Joined</th>
              <th className="hidden md:table-cell px-4 py-2.5 font-medium">Left</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No club history recorded.{" "}
                  <Link href="/admin/player-history/new" className="text-navy-700 hover:underline">
                    Record a spell →
                  </Link>
                </td>
              </tr>
            ) : (
              (rows ?? []).map((h: any) => (
                <tr key={h.history_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-navy-900">
                      {h.player ? `${h.player.first_name} ${h.player.last_name}`.trim() : "—"}
                    </p>
                    {/* Mobile-only detail row */}
                    <div className="sm:hidden mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{h.team?.name ?? "—"}</span>
                      {h.season && <span>· {h.season}</span>}
                      {h.role && <span>· {h.role}</span>}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-slate-600">{h.team?.name ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{h.season ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{h.role ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(h.joined_date)}</td>
                  <td className="hidden md:table-cell px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmt(h.left_date)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/player-history/${h.history_id}`}
                      className="sm:hidden inline-block bg-navy-900 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-navy-700"
                    >
                      Edit
                    </Link>
                    <span className="hidden sm:inline-flex items-center gap-2">
                      <Link href={`/admin/player-history/${h.history_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                      <DeleteRowButton id={h.history_id} action={deletePlayerHistory} />
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
