import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Whether a match has actually been played.
 *
 * The date alone is not the answer: a match kicking off at two o'clock is
 * still today's date at six, so splitting on the date left a finished match
 * sitting under "coming up" with no score against it. A result, or a fixture
 * marked completed, is what settles it.
 */
function isPlayed(f: any): boolean {
  const r = Array.isArray(f?.result) ? f.result[0] : f?.result;
  if (r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0)) return true;
  return ["completed", "abandoned", "cancelled"].includes(f?.status ?? "");
}

export default async function ClubFixturesPage() {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, status, home_team_id, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name, season), result:match_results(home_score, away_score)"
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("scheduled_date", { ascending: false })
    .limit(300);

  const rows = fixtures ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows
    .filter((f: any) => !isPlayed(f) && (f.scheduled_date ?? "") >= today)
    .reverse();
  const past = rows.filter(
    (f: any) => isPlayed(f) || (f.scheduled_date ?? "") < today
  );

  const Table = ({ list, title }: { list: any[]; title: string }) =>
    list.length === 0 ? null : (
      <section className="mb-6">
        <h2 className="font-display text-lg text-navy-900 mb-2">{title}</h2>
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {list.map((f: any) => {
            const r = Array.isArray(f.result) ? f.result[0] : f.result;
            const home = f.home_team_id === teamId;
            return (
              <div key={f.fixture_id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-slate-500 w-24 shrink-0">{f.scheduled_date ?? "TBC"}</span>
                <span className="flex-1 min-w-[12rem] text-navy-900">
                  {f.home?.name} <span className="text-slate-400">v</span> {f.away?.name}
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">
                    {home ? "home" : "away"}
                  </span>
                </span>
                {r ? (
                  <span className="font-display tabular-nums text-navy-900">
                    {r.home_score}–{r.away_score}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{f.scheduled_time ?? f.status}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-navy-900">Fixtures</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your matches, as the federation has them. Results and line-ups are
          recorded by match officials.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500">
          No fixtures on record for your club yet.
        </div>
      ) : (
        <>
          <Table list={upcoming} title="Coming up" />
          <Table list={past} title="Played" />
        </>
      )}
    </div>
  );
}
