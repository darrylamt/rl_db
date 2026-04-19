import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteTeam } from "./actions";

export default async function TeamsPage() {
  const supabase = createAdminClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select(
      "team_id, name, region, city, manager_name, coach_name, founded_year, home_venue:home_venue_id(name)"
    )
    .order("name");

  return (
    <div className="p-8">
      <LiveRefresh tables={["teams"]} />
      <ListHeader title="Teams" addHref="/admin/teams/new" addLabel="Add Team" />

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
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
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No teams yet.{" "}
                  <Link href="/admin/teams/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (teams ?? []).map((t: any) => (
                <tr key={t.team_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{t.name}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
