import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteOfficial } from "./actions";

export default async function OfficialsPage() {
  const supabase = createAdminClient();
  const { data: officials, error } = await supabase
    .from("officials")
    .select("official_id, first_name, last_name, role, region, status, photo_url")
    .order("last_name");

  return (
    <div className="p-8">
      <LiveRefresh tables={["officials"]} />
      <ListHeader title="Officials" addHref="/admin/officials/new" addLabel="Add Official" />

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium"></th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(officials ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No officials yet.{" "}
                  <Link href="/admin/officials/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (officials ?? []).map((o: any) => (
                <tr key={o.official_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {o.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center">
                        {o.first_name?.[0]}{o.last_name?.[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {o.first_name} {o.last_name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{o.role ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{o.region ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.status === "active" ? "bg-emerald-50 text-emerald-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {o.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/officials/${o.official_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={o.official_id} action={deleteOfficial} />
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
