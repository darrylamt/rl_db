import Link from "next/link";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

const WORDS: Record<string, string> = {
  draft: "Not sent",
  submitted: "With the federation",
  approved: "Approved",
  declined: "Sent back",
};

export default async function ClubTeamSheetsPage() {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: fixtures }, { data: sheets, error }, { data: named }] =
    await Promise.all([
      supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, scheduled_time, status, home_team_id, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name, season)"
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true })
        .limit(20),
      supabase
        .from("team_sheets")
        .select("fixture_id, status, review_note, submitted_at")
        .eq("team_id", teamId),
      supabase
        .from("match_lineups")
        .select("fixture_id")
        .eq("team_id", teamId),
    ]);

  const sheetFor = new Map(
    ((sheets ?? []) as any[]).map((s) => [s.fixture_id, s])
  );
  const countFor = new Map<string, number>();
  for (const l of (named ?? []) as any[]) {
    countFor.set(l.fixture_id, (countFor.get(l.fixture_id) ?? 0) + 1);
  }

  const rows = (fixtures ?? []) as any[];
  const notMigrated = !!error && /team_sheets/.test(error.message);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-navy-900">Team Sheets</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Name your side before the match. The federation approves it, and the
          match-day recorder works from the names you give here.
        </p>
      </div>

      {notMigrated && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-4">
          Run <code className="font-mono">supabase/team_sheets.sql</code> to turn
          this on.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500">
          No upcoming fixtures for your club.
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((f) => {
            const sheet = sheetFor.get(f.fixture_id);
            const status = sheet?.status ?? "draft";
            const count = countFor.get(f.fixture_id) ?? 0;
            const home = f.home_team_id === teamId;
            return (
              <li key={f.fixture_id}>
                <Link
                  href={`/club/team-sheets/${f.fixture_id}`}
                  className="block bg-white border border-slate-200 hover:border-navy-300 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900 truncate">
                        {f.home?.name} <span className="text-slate-400">v</span>{" "}
                        {f.away?.name}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">
                          {home ? "home" : "away"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[
                          f.scheduled_date,
                          f.scheduled_time?.slice(0, 5),
                          f.venue?.name,
                          f.competition?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {status === "declined" && sheet?.review_note && (
                        <p className="text-xs text-red-700 mt-1">
                          Sent back — {sheet.review_note}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          TONE[status] ?? TONE.draft
                        }`}
                      >
                        {WORDS[status] ?? status}
                      </span>
                      <span className="block text-xs text-slate-500 mt-1">
                        {count > 0 ? `${count} named` : "nobody named"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
