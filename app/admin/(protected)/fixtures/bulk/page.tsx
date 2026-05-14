import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { BulkFixtureForm } from "./BulkFixtureForm";

export const dynamic = "force-dynamic";

export default async function BulkFixturePage() {
  const supabase = createAdminClient();

  const [{ data: teams }, { data: comps }, { data: venues }] = await Promise.all([
    supabase.from("teams").select("team_id, name").order("name"),
    supabase.from("competitions").select("competition_id, name, season").order("name"),
    supabase.from("venues").select("venue_id, name").order("name"),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/admin/fixtures" className="text-xs text-slate-500 hover:underline mb-2 inline-block">
          ← Fixtures
        </Link>
        <h1 className="text-2xl font-display font-bold text-navy-900">Bulk Add Fixtures</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set shared competition, venue and date, then add as many fixture rows as you need.
        </p>
      </div>

      <BulkFixtureForm
        teams={teams ?? []}
        comps={comps ?? []}
        venues={venues ?? []}
      />
    </div>
  );
}
