import { createAdminClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";

type Counts = {
  teams: number;
  players: number;
  officials: number;
  fixtures: number;
};

async function getCounts(): Promise<Counts> {
  const supabase = createAdminClient();
  const [teams, players, officials, fixtures] = await Promise.all([
    supabase.from("teams").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("officials").select("*", { count: "exact", head: true }),
    supabase.from("fixtures").select("*", { count: "exact", head: true }),
  ]);
  return {
    teams: teams.count ?? 0,
    players: players.count ?? 0,
    officials: officials.count ?? 0,
    fixtures: fixtures.count ?? 0,
  };
}

async function getUpcoming() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const next7 = new Date(Date.now() + 7 * 24 * 3600_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, round, status, home_team:home_team_id(name), away_team:away_team_id(name), venue:venue_id(name), competition:competition_id(name)"
    )
    .gte("scheduled_date", today)
    .lte("scheduled_date", next7)
    .order("scheduled_date", { ascending: true });
  return data ?? [];
}

async function getRecentResults() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("match_results")
    .select(
      "result_id, home_score, away_score, recorded_at, fixture:fixture_id(scheduled_date, home_team:home_team_id(name), away_team:away_team_id(name), competition:competition_id(name))"
    )
    .order("recorded_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export default async function DashboardPage() {
  const [counts, upcoming, recent] = await Promise.all([
    getCounts(),
    getUpcoming(),
    getRecentResults(),
  ]);

  const stats = [
    { label: "Teams", value: counts.teams },
    { label: "Players", value: counts.players },
    { label: "Officials", value: counts.officials },
    { label: "Fixtures", value: counts.fixtures },
  ];

  return (
    <div className="p-8">
      <LiveRefresh
        tables={["fixtures", "match_results", "teams", "players", "officials"]}
      />
      <header className="mb-8">
        <p className="text-gold-600 font-display tracking-widest text-xs">
          OVERVIEW
        </p>
        <h1 className="font-display text-4xl font-bold text-navy-900">
          Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">Live — updates automatically.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {s.label}
            </p>
            <p className="font-display text-4xl font-bold text-navy-900 mt-2">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
            Upcoming this week
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-slate-500 text-sm">No fixtures scheduled.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((f: any) => (
                <li key={f.fixture_id} className="py-3 text-sm">
                  <div className="font-medium">
                    {f.home_team?.name} vs {f.away_team?.name}
                  </div>
                  <div className="text-slate-500 text-xs">
                    {f.scheduled_date}
                    {f.scheduled_time ? ` @ ${f.scheduled_time}` : ""} •{" "}
                    {f.competition?.name || "—"} • {f.venue?.name || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
            Recent results
          </h2>
          {recent.length === 0 ? (
            <p className="text-slate-500 text-sm">No results recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((r: any) => (
                <li key={r.result_id} className="py-3 text-sm">
                  <div className="font-medium">
                    {r.fixture?.home_team?.name} {r.home_score} –{" "}
                    {r.away_score} {r.fixture?.away_team?.name}
                  </div>
                  <div className="text-slate-500 text-xs">
                    {r.fixture?.competition?.name || "—"} •{" "}
                    {r.fixture?.scheduled_date || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
