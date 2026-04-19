import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteVenue } from "./actions";

export default async function VenuesPage() {
  const supabase = createAdminClient();
  const { data: venues, error } = await supabase
    .from("venues")
    .select("venue_id, name, region, city, capacity")
    .order("name");

  return (
    <div className="p-8">
      <LiveRefresh tables={["venues"]} />
      <ListHeader title="Venues" addHref="/admin/venues/new" addLabel="Add Venue" />

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
              <th className="px-4 py-2.5 font-medium">Capacity</th>
              <th className="px-4 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(venues ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No venues yet.{" "}
                  <Link href="/admin/venues/new" className="text-navy-700 hover:underline">
                    Add the first one →
                  </Link>
                </td>
              </tr>
            ) : (
              (venues ?? []).map((v: any) => (
                <tr key={v.venue_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{v.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.region ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.city ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.capacity?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <Link href={`/admin/venues/${v.venue_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                    <DeleteRowButton id={v.venue_id} action={deleteVenue} />
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
