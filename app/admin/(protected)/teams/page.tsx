import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPageParams } from "@/lib/pagination";
import { deleteTeam } from "./actions";

const TYPES = ["all", "club", "national", "president_xv"] as const;
type TypeFilter = (typeof TYPES)[number];

const TYPE_LABEL: Record<Exclude<TypeFilter, "all">, string> = {
  club: "Club",
  national: "National",
  president_xv: "President XIII",
};

const TYPE_BADGE: Record<Exclude<TypeFilter, "all">, string> = {
  club: "bg-slate-100 text-slate-700",
  national: "bg-emerald-100 text-emerald-800",
  president_xv: "bg-amber-100 text-amber-800",
};

function parseType(raw: string | string[] | undefined): TypeFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (TYPES as readonly string[]).includes(v ?? "")
    ? (v as TypeFilter)
    : "all";
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const { page, pageSize, from, to } = getPageParams(searchParams, 20);
  const typeFilter = parseType(searchParams?.type);

  let query = supabase
    .from("teams")
    .select(
      "team_id, name, team_type, region, city, manager_name, coach_name, founded_year, home_venue:home_venue_id(name)",
      { count: "exact" }
    )
    .order("name")
    .range(from, to);

  if (typeFilter !== "all") query = query.eq("team_type", typeFilter);

  const { data: teams, error, count } = await query;

  const tabs: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "club", label: "Club" },
    { key: "national", label: "National" },
    { key: "president_xv", label: "President XIII" },
  ];

  function tabHref(key: TypeFilter) {
    if (key === "all") return "/admin/teams";
    return `/admin/teams?type=${key}`;
  }

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["teams"]} />
      <ListHeader title="Teams" addHref="/admin/teams/new" addLabel="Add Team" />

      <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
        {tabs.map((t) => {
          const active = typeFilter === t.key;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition " +
                (active
                  ? "border-navy-700 text-navy-900"
                  : "border-transparent text-slate-600 hover:text-navy-700")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">City</th>
              <th className="px-4 py-2.5 font-medium">Home venue</th>
              <th className="px-4 py-2.5 font-medium">Manager</th>
              <th className="px-4 py-2.5 font-medium">Coach</th>
              <th className="px-4 py-2.5 font-medium">Founded</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(teams ?? []).length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No teams{typeFilter !== "all" ? ` in ${TYPE_LABEL[typeFilter]}` : ""} yet.{" "}
                  <Link href="/admin/teams/new" className="text-navy-700 hover:underline">
                    Add one →
                  </Link>
                </td>
              </tr>
            ) : (
              (teams ?? []).map((t: any) => {
                const tt = (t.team_type ?? "club") as Exclude<TypeFilter, "all">;
                return (
                  <tr key={t.team_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-navy-900">{t.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGE[tt]}`}>
                        {TYPE_LABEL[tt]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{t.region ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.city ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {t.home_venue?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{t.manager_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.coach_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.founded_year ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                      <Link
                        href={`/admin/teams/${t.team_id}`}
                        className="text-navy-700 hover:underline text-sm"
                      >
                        Edit
                      </Link>
                      <DeleteRowButton id={t.team_id} action={deleteTeam} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}
