import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { deleteEvent } from "./actions";
import { EVENT_CATEGORIES } from "./EventFields";

export const dynamic = "force-dynamic";

const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function EventsAdminPage() {
  const { data, error } = await createAdminClient()
    .from("federation_events")
    .select("event_id, title, category, starts_on, start_time, ends_on, venue, status")
    .order("starts_on", { ascending: true });

  const notReady = error && (error.code === "42P01" || error.code === "PGRST205");
  const today = new Date().toISOString().slice(0, 10);
  const all = (data ?? []) as any[];
  // Upcoming soonest first; past newest first.
  const upcoming = all.filter((e) => (e.ends_on ?? e.starts_on) >= today);
  const past = all.filter((e) => (e.ends_on ?? e.starts_on) < today).reverse();
  const label = (c: string) => EVENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;

  const table = (rows: any[], empty: string) => (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700 text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Event</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="hidden md:table-cell px-4 py-2.5 font-medium">Venue</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">{empty}</td></tr>
          ) : rows.map((e) => (
            <tr key={e.event_id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <span className="font-medium text-navy-900">{e.title}</span>
                <span className="block text-xs text-slate-500">
                  {label(e.category)}
                  {e.status !== "published" && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded ${e.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{e.status}</span>
                  )}
                </span>
              </td>
              <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                {fmt(e.starts_on)}{e.ends_on && e.ends_on !== e.starts_on ? ` – ${fmt(e.ends_on)}` : ""}
                {e.start_time && <span className="block text-xs text-slate-500">{String(e.start_time).slice(0, 5)}</span>}
              </td>
              <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{e.venue ?? "—"}</td>
              <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                <Link href={`/admin/events/${e.event_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                <DeleteRowButton id={e.event_id} action={deleteEvent} confirmText="Remove this event from the site?" label="Remove" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Events" addHref="/admin/events/new" addLabel="Add Event" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Tournaments, clinics, AGMs and other RLFG events. Shown on the website&apos;s Events page, with the next few on its homepage.
      </p>

      {notReady ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2 rounded">
          Events aren&apos;t set up yet. Run <code>supabase/federation_events.sql</code> in Supabase, then come back.
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded">{error.message}</div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="font-display text-lg text-navy-900 mb-2">Upcoming <span className="text-slate-400 text-sm font-sans">({upcoming.length})</span></h2>
            {table(upcoming, "Nothing coming up. Add the next event.")}
          </section>
          <section>
            <h2 className="font-display text-lg text-navy-900 mb-2">Past <span className="text-slate-400 text-sm font-sans">({past.length})</span></h2>
            {table(past, "No past events yet.")}
          </section>
        </div>
      )}
    </div>
  );
}
