import { requirePlayer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { setAvailability } from "../actions";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: me } = await supabase
    .from("players")
    .select("team_id")
    .eq("player_id", playerId)
    .maybeSingle();

  const teamId = (me as any)?.team_id;

  const [{ data: fixtures }, { data: answers, error }] = await Promise.all([
    teamId
      ? supabase
          .from("fixtures")
          .select(
            "fixture_id, scheduled_date, scheduled_time, round, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name)"
          )
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .gte("scheduled_date", today)
          .eq("status", "scheduled")
          .order("scheduled_date")
          .limit(12)
      : { data: [] as any[] },
    supabase
      .from("player_availability")
      .select("fixture_id, status")
      .eq("player_id", playerId),
  ]);

  const answerFor = new Map(
    ((answers ?? []) as any[]).map((a) => [a.fixture_id, a.status])
  );
  const rows = (fixtures ?? []) as any[];
  const notMigrated = !!error && /player_availability/.test(error.message);

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold">Availability</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Tell your club which matches you can play. Signing out means you
          cannot be named. Saying nothing means you can be — so you only need
          to speak up when something is wrong.
        </p>
      </div>

      {searchParams?.error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-200 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.note}
        </div>
      )}

      {notMigrated ? (
        <div className="bg-amber-900/25 border border-amber-700 text-amber-200 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/contracts_and_players.sql</code> to
          turn this on.
        </div>
      ) : !teamId ? (
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-8 text-center text-slate-500 text-sm">
          You are not at a club at the moment, so there is nothing to be
          available for.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-neutral-900 border border-white/10 rounded-lg p-8 text-center text-slate-500 text-sm">
          No matches coming up for your club.
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((f) => {
            const answer = answerFor.get(f.fixture_id);
            return (
              <li
                key={f.fixture_id}
                className={`bg-neutral-900 border rounded-lg px-4 py-3 ${
                  answer === "out" ? "border-red-700/50" : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-white break-words">
                      {f.home?.name} <span className="text-slate-400">v</span> {f.away?.name}
                    </p>
                    <p className="text-xs text-slate-400 break-words">
                      {[f.scheduled_date, f.scheduled_time?.slice(0, 5), f.venue?.name, f.competition?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <form action={setAvailability.bind(null, f.fixture_id, "in")}>
                      <button
                        className={`text-xs font-medium px-3 py-1.5 rounded border ${
                          answer === "in"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "border-white/20 text-slate-300 hover:border-emerald-400"
                        }`}
                      >
                        Available
                      </button>
                    </form>
                    <form action={setAvailability.bind(null, f.fixture_id, "out")}>
                      <button
                        className={`text-xs font-medium px-3 py-1.5 rounded border ${
                          answer === "out"
                            ? "bg-red-600 text-white border-red-600"
                            : "border-white/20 text-slate-300 hover:border-red-400"
                        }`}
                      >
                        Not available
                      </button>
                    </form>
                    {answer && (
                      <form action={setAvailability.bind(null, f.fixture_id, "clear")}>
                        <button className="text-xs px-2.5 py-1.5 rounded text-slate-500 hover:text-white">
                          Clear
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {answer === "out" && (
                  <p className="text-xs text-red-300 mt-2">
                    Your club cannot name you for this one.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
