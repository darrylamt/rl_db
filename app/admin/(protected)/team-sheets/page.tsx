import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { SheetCard } from "@/components/admin/SheetCard";
import { approveSheet, declineSheet, reopenSheet } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamSheetsPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("team_sheets")
    .select(
      "sheet_id, status, submitted_at, review_note, team:team_id(team_id, name, logo_url), fixture:fixture_id(fixture_id, scheduled_date, scheduled_time, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))"
    )
    .in("status", ["submitted", "approved", "declined"])
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(100);

  const rows = (data ?? []) as any[];
  const notMigrated = !!error && /team_sheets/.test(error.message);

  // Only sheets for matches still to come are actionable; the rest are
  // history and would bury the queue.
  const upcoming = rows.filter(
    (r) => (r.fixture?.scheduled_date ?? "9999") >= today
  );
  const waiting = upcoming.filter((r) => r.status === "submitted");
  const approved = upcoming.filter((r) => r.status === "approved");
  const sentBack = upcoming.filter((r) => r.status === "declined");

  // The names are fetched once for everything on screen rather than per card.
  const ids = upcoming.map((r) => r.fixture?.fixture_id).filter(Boolean);
  const { data: lineups } = ids.length
    ? await supabase
        .from("match_lineups")
        .select("fixture_id, team_id, jersey_number, is_starter, player:player_id(first_name, last_name)")
        .in("fixture_id", Array.from(new Set(ids)))
    : { data: [] as any[] };

  const namesFor = (fixtureId: string, teamId: string) =>
    ((lineups ?? []) as any[])
      .filter((l) => l.fixture_id === fixtureId && l.team_id === teamId)
      .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Team Sheets" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Sides named by clubs in their own portal. An approved sheet is what the
        match-day recorder works from, so approving one is what puts those
        players in front of them.
      </p>

      {searchParams?.error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.note}
        </div>
      )}

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/team_sheets.sql</code> to turn
          this on.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-3">
              Waiting on you{waiting.length > 0 && ` (${waiting.length})`}
            </h2>
            {waiting.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                Nothing waiting. Sides submitted by clubs appear here.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {waiting.map((s) => (
                  <SheetCard
                    key={s.sheet_id}
                    sheet={s}
                    names={namesFor(s.fixture?.fixture_id, s.team?.team_id)}
                    approve={approveSheet}
                    decline={declineSheet}
                  />
                ))}
              </div>
            )}
          </section>

          {sentBack.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-lg text-navy-900 mb-3">
                Sent back ({sentBack.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {sentBack.map((s) => (
                  <SheetCard
                    key={s.sheet_id}
                    sheet={s}
                    names={namesFor(s.fixture?.fixture_id, s.team?.team_id)}
                    approve={approveSheet}
                    decline={declineSheet}
                  />
                ))}
              </div>
            </section>
          )}

          {approved.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-navy-900 mb-1">
                Approved ({approved.length})
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Reopen one if a side has to change after approval — an injury in
                the warm-up, say — rather than editing the line-up yourself.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {approved.map((s) => (
                  <SheetCard
                    key={s.sheet_id}
                    sheet={s}
                    names={namesFor(s.fixture?.fixture_id, s.team?.team_id)}
                    approve={approveSheet}
                    decline={declineSheet}
                    reopen={reopenSheet}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 mt-6">
        <Link href="/admin/fixtures" className="text-navy-700 hover:underline">
          Fixtures →
        </Link>
      </p>
    </div>
  );
}
