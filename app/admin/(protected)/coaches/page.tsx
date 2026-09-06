import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { getPageParams } from "@/lib/pagination";
import { deleteCoach } from "./actions";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CoachesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 10);
  const q = (first(searchParams?.q) ?? "").trim();

  let query = supabase
    .from("coaches")
    .select(
      "coach_id, first_name, last_name, role, status, photo_url, team:team_id(name)",
      { count: "exact" },
    )
    .order("last_name")
    .range(from, to);

  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

  const { data: coaches, error, count } = await query;

  // How many matches each has taken charge of, so the register shows who is
  // actually working rather than only who is registered.
  const ids = (coaches ?? []).map((c: any) => c.coach_id);
  const matches = new Map<string, number>();
  if (ids.length > 0) {
    const list = ids.join(",");
    const { data: sheets } = await supabase
      .from("team_sheets")
      .select("head_coach_id, assistant_coach_id")
      .or(`head_coach_id.in.(${list}),assistant_coach_id.in.(${list})`);
    for (const s of (sheets ?? []) as any[]) {
      for (const id of [s.head_coach_id, s.assistant_coach_id]) {
        if (id) matches.set(id, (matches.get(id) ?? 0) + 1);
      }
    }
  }

  const notMigrated =
    !!error &&
    /coaches/.test(error.message) &&
    /does not exist|relation/i.test(error.message);

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Coaches" addHref="/admin/coaches/new" addLabel="Add Coach" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        The federation&rsquo;s register. Clubs pick from this when they name a
        side &mdash; a club cannot invent a coach, and a coach tied to a club
        can only be named by that club.
      </p>

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/coaches.sql</code> to turn
          this on.
        </div>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
            <label className="text-sm flex-1 min-w-[12rem]">
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                Search
              </span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Name…"
                className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </label>
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium"
            >
              Search
            </button>
            {q && (
              <Link
                href="/admin/coaches"
                className="text-xs text-slate-500 hover:underline"
              >
                clear
              </Link>
            )}
          </form>

          {error && !notMigrated && (
            <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
              {error.message}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-left">
                <tr>
                  <th className="px-3 py-2.5 font-medium w-10"></th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="hidden md:table-cell px-3 py-2.5 font-medium">Club</th>
                  <th className="hidden md:table-cell px-3 py-2.5 font-medium">Role</th>
                  <th className="hidden md:table-cell px-3 py-2.5 font-medium">Matches</th>
                  <th className="hidden md:table-cell px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(coaches ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No coaches yet.{" "}
                      <Link
                        href="/admin/coaches/new"
                        className="text-navy-700 hover:underline"
                      >
                        Add the first one →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  (coaches ?? []).map((c: any) => {
                    const club = Array.isArray(c.team) ? c.team[0] : c.team;
                    return (
                      <tr key={c.coach_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 w-10">
                          {c.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.photo_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-9 w-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-500 text-xs font-medium flex items-center justify-center">
                              {c.first_name?.[0]}
                              {c.last_name?.[0]}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-navy-900">
                          {c.first_name} {c.last_name}
                          <div className="md:hidden mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span>{club?.name ?? "any club"}</span>
                            {c.role && <span>· {c.role}</span>}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">
                          {club?.name ?? (
                            <span className="text-slate-400">any club</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-3 py-2.5 text-slate-600">
                          {c.role ?? "—"}
                        </td>
                        <td className="hidden md:table-cell px-3 py-2.5 text-slate-600 tabular-nums">
                          {matches.get(c.coach_id) ?? 0}
                        </td>
                        <td className="hidden md:table-cell px-3 py-2.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              c.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="hidden md:inline-flex items-center gap-3">
                            <Link
                              href={`/admin/coaches/${c.coach_id}`}
                              className="text-navy-700 hover:underline text-sm"
                            >
                              Edit
                            </Link>
                            <DeleteRowButton id={c.coach_id} action={deleteCoach} />
                          </span>
                          <Link
                            href={`/admin/coaches/${c.coach_id}`}
                            className="md:hidden inline-block bg-navy-900 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-navy-700"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
        </>
      )}
    </div>
  );
}
